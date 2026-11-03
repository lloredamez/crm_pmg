export interface CalendarConfig {
  id: string;
  pause_on_weekends: boolean;
  pause_on_holidays: boolean;
  pause_night_shift: boolean;
  work_start_hour: number;
  work_end_hour: number;
  work_days: number[];
  timezone: string;
  updated_at: string;
}

export interface CalendarConfigUpdate {
  pause_on_weekends?: boolean;
  pause_on_holidays?: boolean;
  pause_night_shift?: boolean;
  work_start_hour?: number;
  work_end_hour?: number;
  work_days?: number[];
  timezone?: string;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  holiday_type: string;
  is_recurring: boolean;
  is_active: boolean;
  created_at: string;
}

export interface HolidayCreate {
  date: string;
  name: string;
  holiday_type?: string;
  is_recurring?: boolean;
  is_active?: boolean;
}

export interface HolidayUpdate {
  date?: string;
  name?: string;
  holiday_type?: string;
  is_recurring?: boolean;
  is_active?: boolean;
}

export interface CalendarStatus {
  is_paused: boolean;
  reason?: string | null;
  current_time: string;
  is_weekend: boolean;
  is_holiday: boolean;
  holiday_name?: string | null;
  is_night_shift: boolean;
}

