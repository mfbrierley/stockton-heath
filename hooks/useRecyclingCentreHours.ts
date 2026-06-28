import { useEffect, useState } from "react";
import { theme } from "../app/styles/theme";

type Status = "open" | "closing-soon" | "opening-soon" | "closed";

const FIXED_CLOSURE_DATES = new Set(["12-25", "12-26", "01-01"]);
const SOON_THRESHOLD_MINS = 30;

function getUKTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");

  return {
    month: parseInt(get("month"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    isWeekend: weekday === "Saturday" || weekday === "Sunday",
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    mmdd: `${get("month")}-${get("day")}`,
  };
}

function getTomorrowUKParts() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getUKTimeParts(tomorrow);
}

export function getTodayHours(
  isWeekend: boolean,
  isBankHoliday: boolean,
  isFixedClosed: boolean,
  month: number,
): { open: number; close: number } | null {
  if (isFixedClosed) return null;
  const isSpring = month >= 4 && month <= 9;
  if (isSpring && (isWeekend || isBankHoliday)) {
    return { open: 10, close: 18 };
  }
  return { open: 10, close: 16 };
}

function computeStatus(
  hour: number,
  minute: number,
  hours: { open: number; close: number } | null,
): Status {
  if (!hours) return "closed";
  const current = hour * 60 + minute;
  const open = hours.open * 60;
  const close = hours.close * 60;
  if (current >= close) return "closed";
  if (current >= close - SOON_THRESHOLD_MINS) return "closing-soon";
  if (current >= open) return "open";
  if (current >= open - SOON_THRESHOLD_MINS) return "opening-soon";
  return "closed";
}

export function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

export type StatusConfig = {
  label: string;
  color: string;
  bg: string;
  icon: string;
};

export const STATUS_CONFIG: Record<Status, StatusConfig> = {
  open: {
    label: "Open now",
    color: theme.colors.statusGreen,
    bg: "#DCFCE7",
    icon: "checkmark-circle",
  },
  "closing-soon": {
    label: "Closing soon",
    color: theme.colors.statusAmber,
    bg: "#FEF3C7",
    icon: "time",
  },
  "opening-soon": {
    label: "Opening soon",
    color: theme.colors.statusAmber,
    bg: "#FEF3C7",
    icon: "time",
  },
  closed: {
    label: "Closed",
    color: theme.colors.statusRed,
    bg: "#FEE2E2",
    icon: "close-circle",
  },
};

export function useRecyclingCentreHours() {
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [timeParts, setTimeParts] = useState(getUKTimeParts);

  useEffect(() => {
    fetch("https://www.gov.uk/bank-holidays.json")
      .then((r) => r.json())
      .then((data) => {
        const dates = new Set<string>(
          (data["england-and-wales"].events as { date: string }[]).map(
            (e) => e.date,
          ),
        );
        setBankHolidays(dates);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeParts(getUKTimeParts());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const isBankHoliday = bankHolidays.has(timeParts.dateKey);
  const isFixedClosed = FIXED_CLOSURE_DATES.has(timeParts.mmdd);
  const todayHours = getTodayHours(
    timeParts.isWeekend,
    isBankHoliday,
    isFixedClosed,
    timeParts.month,
  );
  const status = computeStatus(timeParts.hour, timeParts.minute, todayHours);
  const statusConfig = STATUS_CONFIG[status];

  const isPostClose =
    status === "closed" &&
    todayHours !== null &&
    timeParts.hour * 60 + timeParts.minute >= todayHours.close * 60;

  const tomorrowParts = getTomorrowUKParts();
  const isTomorrowBankHoliday = bankHolidays.has(tomorrowParts.dateKey);
  const isTomorrowFixedClosed = FIXED_CLOSURE_DATES.has(tomorrowParts.mmdd);
  const tomorrowHours = getTodayHours(
    tomorrowParts.isWeekend,
    isTomorrowBankHoliday,
    isTomorrowFixedClosed,
    tomorrowParts.month,
  );

  return { todayHours, tomorrowHours, status, statusConfig, isPostClose };
}

function getWoolstonTodayHours(
  isWeekend: boolean,
  isBankHoliday: boolean,
  isFixedClosed: boolean,
): { open: number; close: number } | null {
  if (isFixedClosed) return null;
  if (isWeekend || isBankHoliday) return { open: 8, close: 18 };
  return { open: 10, close: 16 };
}

export function useWoolstonRecyclingCentreHours() {
  const [bankHolidays, setBankHolidays] = useState<Set<string>>(new Set());
  const [timeParts, setTimeParts] = useState(getUKTimeParts);

  useEffect(() => {
    fetch("https://www.gov.uk/bank-holidays.json")
      .then((r) => r.json())
      .then((data) => {
        const dates = new Set<string>(
          (data["england-and-wales"].events as { date: string }[]).map(
            (e) => e.date,
          ),
        );
        setBankHolidays(dates);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeParts(getUKTimeParts());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const isBankHoliday = bankHolidays.has(timeParts.dateKey);
  const isFixedClosed = FIXED_CLOSURE_DATES.has(timeParts.mmdd);
  const todayHours = getWoolstonTodayHours(
    timeParts.isWeekend,
    isBankHoliday,
    isFixedClosed,
  );
  const status = computeStatus(timeParts.hour, timeParts.minute, todayHours);
  const statusConfig = STATUS_CONFIG[status];

  return { statusConfig };
}
