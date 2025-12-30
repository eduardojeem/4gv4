/**
 * Validation schemas exports
 */

export {
  CustomerSchema,
  DeviceSchema,
  DeviceSchemaQuick,
  DeviceTypeEnum,
  AccessTypeEnum,
  PriorityEnum,
  UrgencyEnum,
  RepairFormSchema,
  RepairFormQuickSchema,
  validateRepairForm,
  getFieldErrors,
  hasFieldError,
  getFieldError
} from './repair.schema'

export type {
  CustomerFormData,
  DeviceFormData,
  DeviceFormDataQuick,
  RepairFormData,
  RepairFormDataQuick,
  DeviceType,
  AccessType,
  Priority,
  Urgency
} from './repair.schema'
