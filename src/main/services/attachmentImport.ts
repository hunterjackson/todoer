import type { Database as SqlJsDatabase } from 'sql.js'
import { createAttachmentRepository } from '@main/db/repositories/attachmentRepository'
import type { ExportAttachment } from './dataExport'
import { generateId, sanitizeFilename } from '@shared/utils'

export function importTaskAttachments(
  db: SqlJsDatabase,
  attachments: ExportAttachment[],
  taskIdMap: Map<string, string>
): number {
  const attachmentRepo = createAttachmentRepository(db)
  let attachmentsImported = 0

  for (const attachment of attachments) {
    try {
      const remappedTaskId = attachment.taskId
        ? taskIdMap.get(attachment.taskId) || null
        : null
      if (!remappedTaskId) continue

      const dataBuffer = Buffer.from(attachment.dataBase64, 'base64')

      // Always assign a fresh ID on import to avoid collisions with prior imports.
      const imported = attachmentRepo.addWithMetadata(
        generateId(),
        remappedTaskId,
        sanitizeFilename(attachment.filename),
        attachment.mimeType,
        dataBuffer,
        attachment.createdAt || Date.now()
      )

      // Count only if the record exists after insert attempt.
      if (attachmentRepo.get(imported.id)) {
        attachmentsImported++
      }
    } catch {
      // Skip failures and continue import.
    }
  }

  return attachmentsImported
}
