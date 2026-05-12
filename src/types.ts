/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClassSchedule {
  id: string;
  className: string;
  roomNumber: string;
  days: string[]; // ['Mon', 'Tue', ...]
  startTime: string; // HH:mm
  date?: string; // YYYY-MM-DD
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}
