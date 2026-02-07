import { DEFAULT_SETTINGS } from '@shared/constants'
import { validateShortcutsJSON } from '@shared/shortcuts'

export type SettingKey = keyof typeof DEFAULT_SETTINGS

const VALID_SETTING_KEYS = new Set<SettingKey>(
  Object.keys(DEFAULT_SETTINGS) as SettingKey[]
)

function isIntegerInRange(value: string, min: number, max: number): boolean {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

export function validateSettingEntry(
  key: string,
  value: string
): { key: SettingKey; value: string } {
  if (!VALID_SETTING_KEYS.has(key as SettingKey)) {
    throw new Error(`Invalid setting key: ${key}`)
  }

  const settingKey = key as SettingKey
  const normalizedValue = value.trim()

  switch (settingKey) {
    case 'confirmDelete':
    case 'notificationsEnabled': {
      if (normalizedValue !== 'true' && normalizedValue !== 'false') {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'timeFormat': {
      if (normalizedValue !== '12h' && normalizedValue !== '24h') {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'dateFormat': {
      if (
        normalizedValue !== 'mdy' &&
        normalizedValue !== 'dmy' &&
        normalizedValue !== 'ymd'
      ) {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'weekStart': {
      if (!isIntegerInRange(normalizedValue, 0, 1)) {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'dailyGoal':
    case 'weeklyGoal': {
      if (!isIntegerInRange(normalizedValue, 1, 1000)) {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'quietHoursStart':
    case 'quietHoursEnd': {
      if (!isIntegerInRange(normalizedValue, 0, 23)) {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'defaultProject': {
      if (!normalizedValue) {
        throw new Error(`Invalid value for ${settingKey}: ${value}`)
      }
      return { key: settingKey, value: normalizedValue }
    }

    case 'keyboardShortcuts': {
      // Validate JSON structure and return the original string
      validateShortcutsJSON(normalizedValue)
      return { key: settingKey, value: normalizedValue }
    }
  }
}
