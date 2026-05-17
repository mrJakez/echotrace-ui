const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit"
});

const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit"
});

export function startOfWeek(input: Date) {
  const date = new Date(input);
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

export function addDays(input: Date, days: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
}

export function addWeeks(input: Date, weeks: number) {
  return addDays(input, weeks * 7);
}

export function toDateKey(input: Date) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayLabel(input: Date) {
  return WEEKDAY_FORMATTER.format(input);
}

export function formatTime(input: string | Date) {
  return TIME_FORMATTER.format(new Date(input));
}

export function formatDuration(startedAt: string, endedAt: string) {
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.max(Math.round(diffMs / 60000), 0);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${restMinutes}m`;
  }

  return `${restMinutes}m`;
}

export function formatSentenceOffset(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}
