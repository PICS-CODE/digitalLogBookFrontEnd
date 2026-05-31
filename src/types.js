/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} rfid
 * @property {string} [password]
 * @property {string} lastName
 * @property {string} givenName
 * @property {string} [middleName]
 * @property {string} [email]
 * @property {string} [birthday]
 * @property {string} [phone]
 * @property {string} [address]
 * @property {string} [maritalStatus]
 * @property {string} [gender]
 * @property {string} [ageBracket]
 * @property {string} [institution]
 * @property {string} [patronType]
 * @property {object} [emergencyContact]
 * @property {string} [emergencyContact.fullName]
 * @property {string} [emergencyContact.phone]
 * @property {string} [photoUrl]
 * @property {string} [createdAt]
 * @property {"superadmin" | "admin" | "client"} [role]
 */
export const User = {}; // Placeholder for JSDoc

/**
 * @typedef {object} LogRecord
 * @property {string} id
 * @property {string} rfid
 * @property {string} userFullName
 * @property {string} patronType
 * @property {string[]} services
 * @property {string} checkInTime
 * @property {string} status
 * @property {string} [checkOutTime]
 * @property {number} [pagesPrinted]
 */
export const LogRecord = {}; // Placeholder for JSDoc

/**
 * @typedef {object} ServiceOption
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} description
 * @property {string} color
 */
export const ServiceOption = {}; // Placeholder for JSDoc

/**
 * @typedef {object} EmergencyContact
 * @property {string} fullName
 * @property {string} phone
 */
export const EmergencyContact = {}; // Placeholder for JSDoc
