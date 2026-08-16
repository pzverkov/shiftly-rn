/**
 * Translations.
 *
 * English is the source of truth and its shape (`Translation`) is what every other
 * locale is type-checked against, so a missing or misspelled key fails to compile
 * rather than falling back silently at runtime. Interpolations use i18n-js's
 * `{{name}}` syntax.
 *
 * Hebrew is here specifically to exercise right-to-left: restaurant floor staff
 * are among the most multilingual workforces there is, and RTL is the layout case
 * most likely to be quietly broken (hardcoded left/right, row order, text
 * alignment). Supporting it is both a real inclusivity win and a robustness test
 * of the UI.
 */

export const en = {
  screen: { title: 'Your shifts' },
  list: {
    emptyTitle: 'No shifts scheduled',
    emptyDetail: 'When your manager schedules a shift, it will show up here.',
  },
  offline: { banner: "You're offline. Showing your last known shifts." },
  sync: {
    offlineWaitingOne: "You're offline. 1 action is saved and will sync when you're back.",
    offlineWaitingMany: "You're offline. {{count}} actions are saved and will sync when you're back.",
    syncingOne: 'Back online. Syncing 1 action...',
    syncingMany: 'Back online. Syncing {{count}} actions...',
    syncedAll: "All caught up. You're back online and everything synced.",
    chipSyncing: 'Syncing',
    chipSynced: 'Synced',
    a11ySynced: 'Your saved actions have synced.',
  },
  dev: {
    toggleLabel: 'Simulate being at the branch',
    usingBranch: 'Using the branch location',
    usingGps: "Using this device's real GPS",
  },
  fatal: {
    title: 'Something went wrong',
    detail: 'The app ran into an unexpected problem. You can try again.',
    reportCta: 'Send a report',
    reportSent: 'Thanks - the team has been notified.',
    reportFailed: "Couldn't send the report. Please try again.",
  },
  error: {
    offlineTitle: "You're offline",
    offlineDetail: 'Connect to the internet to see your shifts.',
    serverTitle: "Can't reach the server",
    serverDetail: 'Check that the API is running, then try again.',
    tryAgain: 'Try again',
  },
  badge: {
    onShiftSince: 'On shift since {{time}}',
    ready: 'Ready to clock in',
    finished: 'Finished',
    notClockedIn: 'Not clocked in',
    onBreak: 'On break',
  },
  clockIn: {
    opensIn: 'Clock in opens in',
    button: 'Clock in',
    clocking: 'Clocking in',
    checkingLocation: 'Checking you are at the branch',
    waitingSignal: 'Waiting for signal',
    savedOffline: "Saved. We'll send this as soon as you're back online.",
    disabledHint: 'You can clock in from {{minutes}} minutes before your shift starts',
  },
  clockOut: {
    button: 'Clock out',
    clocking: 'Clocking out',
    checkingLocation: 'Checking you are at the branch',
    waitingSignal: 'Waiting for signal',
  },
  break: {
    start: 'Go on break',
    starting: 'Starting break',
    end: 'End break',
    ending: 'Ending break',
    waitingSignal: 'Waiting for signal',
    savedOffline: "Saved. We'll send this as soon as you're back online.",
    onBreakSince: 'On break since {{time}}',
    countOf: 'Break {{current}} of {{max}}',
    blockedTooSoon: 'Available 2 minutes after your shift starts',
    blockedLimit: "You've used both breaks",
    endHint: 'A break must last at least 2 minutes',
  },
  day: { today: 'Today', tomorrow: 'Tomorrow' },
  a11y: {
    countdown: 'Clock in available in {{minutes}} minutes',
    countdownSoon: 'Clock in available in less than a minute',
    clockedIn: 'Clocked in',
    clockedOut: 'Clocked out',
    wentOnBreak: 'Break started',
    endedBreak: 'Break ended',
    loadingShifts: 'Loading your shifts',
  },
  advice: {
    deniedTitle: 'Location permission needed',
    deniedDetailAskable: 'We check you are at your branch when you clock in. Allow location access to continue.',
    deniedDetailSettings: 'Location is blocked for this app. Turn it on in Settings to clock in.',
    servicesOffTitle: 'Location is switched off',
    servicesOffDetail: 'Turn on Location Services in your device settings, then try again.',
    timeoutTitle: "Couldn't find your location",
    timeoutDetail: 'This usually means a weak GPS signal indoors. Move near a window and try again.',
    unavailableTitle: 'Location unavailable',
    unavailableDetail: "We couldn't read your location. Please try again in a moment.",
    openSettings: 'Open Settings',
    noConnectionTitle: 'No connection',
    noConnectionDetail: "We'll send your clock-in as soon as you're back online.",
    genericTitle: 'Something went wrong',
    genericDetail: 'Please try again.',
    coarseTitle: "Couldn't confirm where you are",
    coarseDetailWithAccuracy:
      "Your location is only accurate to about {{accuracy}}, so we can't tell if you're at the branch. Turn on Precise Location and try again.",
    coarseDetailNoAccuracy:
      "Your location isn't precise enough to confirm you're at the branch. Turn on Precise Location and try again.",
    tooFarTitle: 'Too far from your branch',
    tooFarDetailWithDistance: "You're about {{distance}} away. You need to be within {{limit}} to clock in.",
    cannotTitle: 'Cannot clock in',
    breakFailedTitle: "Couldn't update your break",
    breakOfflineDetail: "We'll record it as soon as you're back online.",
  },
  // A business rejection arrives as a code; we say it in the user's language rather
  // than surface the server's English `message`. Keyed by ApiErrorCode - see
  // src/features/shifts/messages.ts. An unmapped code falls back to that message.
  serverError: {
    validation: 'Something about that request was not valid. Please try again.',
    notFound: "That shift couldn't be found. Pull to refresh and try again.",
    wrongDay: 'You can only clock in on the day the shift is scheduled.',
    startTooEarly: 'You can clock in from {{minutes}} minutes before your shift starts.',
    alreadyStarted: 'This shift has already been started.',
    alreadyFinished: 'This shift has already been finished.',
    notStarted: "This shift hasn't been started yet.",
    finishTooLate: "This shift can't be clocked out more than {{minutes}} minutes after it ends.",
    outOfRange: 'You need to be at the branch to clock in or out.',
    breakTooSoon: 'You can take a break from {{minutes}} minutes after your shift starts.',
    breakLimit: "You've already taken both breaks for this shift.",
    breakAlreadyActive: "You're already on a break.",
    breakNotActive: "You're not on a break right now.",
    breakEndTooSoon: 'A break must last at least {{minutes}} minutes before you can end it.',
  },
  // Distance units, formatted per region (see src/features/shifts/format.ts). Feet
  // are only ever shown to a US device; the key exists in every locale for parity.
  units: {
    meters: '{{value}} m',
    feet: '{{value}} ft',
  },
} as const;

// Widen the `as const` leaves from literal strings to `string`: the const is kept
// only so translation keys stay a precise dot-path union, not so every locale has
// to repeat the English wording.
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Translation = Widen<typeof en>;

// A DeepPartial would let translations rot silently; the full shape forces every
// key to be present. i18n-js still falls back to English at runtime if one slips.
export const he: Translation = {
  screen: { title: 'המשמרות שלך' },
  list: {
    emptyTitle: 'אין משמרות מתוכננות',
    emptyDetail: 'כשהמנהל שלך יקבע משמרת, היא תופיע כאן.',
  },
  offline: { banner: 'אין חיבור לאינטרנט. מוצגות המשמרות האחרונות הידועות.' },
  sync: {
    offlineWaitingOne: 'אין חיבור. פעולה אחת נשמרה ותסונכרן כשתחזור לרשת.',
    offlineWaitingMany: 'אין חיבור. {{count}} פעולות נשמרו ויסונכרנו כשתחזור לרשת.',
    syncingOne: 'חזרת לרשת. מסנכרן פעולה אחת...',
    syncingMany: 'חזרת לרשת. מסנכרן {{count}} פעולות...',
    syncedAll: 'הכול עודכן. חזרת לרשת והכול סונכרן.',
    chipSyncing: 'מסנכרן',
    chipSynced: 'סונכרן',
    a11ySynced: 'הפעולות השמורות שלך סונכרנו.',
  },
  dev: {
    toggleLabel: 'הדמיית נוכחות בסניף',
    usingBranch: 'משתמש במיקום הסניף',
    usingGps: 'משתמש ב-GPS האמיתי של המכשיר',
  },
  fatal: {
    title: 'משהו השתבש',
    detail: 'האפליקציה נתקלה בבעיה בלתי צפויה. אפשר לנסות שוב.',
    reportCta: 'שליחת דיווח',
    reportSent: 'תודה - הצוות קיבל התראה.',
    reportFailed: 'שליחת הדיווח נכשלה. נסה שוב.',
  },
  error: {
    offlineTitle: 'אין חיבור לאינטרנט',
    offlineDetail: 'התחבר לאינטרנט כדי לראות את המשמרות שלך.',
    serverTitle: 'אין גישה לשרת',
    serverDetail: 'ודא שה-API פועל, ואז נסה שוב.',
    tryAgain: 'נסה שוב',
  },
  badge: {
    onShiftSince: 'במשמרת מאז {{time}}',
    ready: 'מוכן להחתמת כניסה',
    finished: 'הסתיימה',
    notClockedIn: 'לא הוחתמה כניסה',
    onBreak: 'בהפסקה',
  },
  clockIn: {
    opensIn: 'החתמת כניסה נפתחת בעוד',
    button: 'החתמת כניסה',
    clocking: 'מחתים כניסה',
    checkingLocation: 'בודק שאתה בסניף',
    waitingSignal: 'ממתין לחיבור',
    savedOffline: 'נשמר. נשלח את זה ברגע שתחזור לרשת.',
    disabledHint: 'ניתן להחתים כניסה החל מ-{{minutes}} דקות לפני תחילת המשמרת',
  },
  clockOut: {
    button: 'החתמת יציאה',
    clocking: 'מחתים יציאה',
    checkingLocation: 'בודק שאתה בסניף',
    waitingSignal: 'ממתין לחיבור',
  },
  break: {
    start: 'יציאה להפסקה',
    starting: 'מתחיל הפסקה',
    end: 'סיום הפסקה',
    ending: 'מסיים הפסקה',
    waitingSignal: 'ממתין לחיבור',
    savedOffline: 'נשמר. נשלח את זה ברגע שתחזור לרשת.',
    onBreakSince: 'בהפסקה מאז {{time}}',
    countOf: 'הפסקה {{current}} מתוך {{max}}',
    blockedTooSoon: 'זמין 2 דקות לאחר תחילת המשמרת',
    blockedLimit: 'ניצלת את שתי ההפסקות',
    endHint: 'הפסקה חייבת להימשך לפחות 2 דקות',
  },
  day: { today: 'היום', tomorrow: 'מחר' },
  a11y: {
    countdown: 'החתמת כניסה תהיה זמינה בעוד {{minutes}} דקות',
    countdownSoon: 'החתמת כניסה תהיה זמינה בעוד פחות מדקה',
    clockedIn: 'הוחתמה כניסה',
    clockedOut: 'הוחתמה יציאה',
    wentOnBreak: 'ההפסקה החלה',
    endedBreak: 'ההפסקה הסתיימה',
    loadingShifts: 'טוען את המשמרות שלך',
  },
  advice: {
    deniedTitle: 'נדרשת הרשאת מיקום',
    deniedDetailAskable: 'אנו בודקים שאתה בסניף בעת החתמת כניסה. אשר גישה למיקום כדי להמשיך.',
    deniedDetailSettings: 'המיקום חסום עבור אפליקציה זו. הפעל אותו בהגדרות כדי להחתים כניסה.',
    servicesOffTitle: 'שירותי המיקום כבויים',
    servicesOffDetail: 'הפעל את שירותי המיקום בהגדרות המכשיר, ואז נסה שוב.',
    timeoutTitle: 'לא הצלחנו לאתר את מיקומך',
    timeoutDetail: 'לרוב זה נובע מקליטת GPS חלשה בתוך מבנה. התקרב לחלון ונסה שוב.',
    unavailableTitle: 'המיקום אינו זמין',
    unavailableDetail: 'לא הצלחנו לקרוא את מיקומך. נסה שוב בעוד רגע.',
    openSettings: 'פתח הגדרות',
    noConnectionTitle: 'אין חיבור',
    noConnectionDetail: 'נשלח את החתמת הכניסה ברגע שתחזור לרשת.',
    genericTitle: 'משהו השתבש',
    genericDetail: 'נסה שוב.',
    coarseTitle: 'לא הצלחנו לאמת את מיקומך',
    coarseDetailWithAccuracy:
      'המיקום שלך מדויק רק לכ-{{accuracy}}, לכן איננו יכולים לקבוע אם אתה בסניף. הפעל מיקום מדויק ונסה שוב.',
    coarseDetailNoAccuracy:
      'המיקום שלך אינו מדויק מספיק כדי לאמת שאתה בסניף. הפעל מיקום מדויק ונסה שוב.',
    tooFarTitle: 'רחוק מדי מהסניף',
    tooFarDetailWithDistance: 'אתה במרחק של כ-{{distance}}. עליך להיות במרחק של עד {{limit}} כדי להחתים כניסה.',
    cannotTitle: 'לא ניתן להחתים כניסה',
    breakFailedTitle: 'לא הצלחנו לעדכן את ההפסקה',
    breakOfflineDetail: 'נרשום אותה ברגע שתחזור לרשת.',
  },
  serverError: {
    validation: 'משהו בבקשה לא היה תקין. נסה שוב.',
    notFound: 'המשמרת לא נמצאה. משוך לרענון ונסה שוב.',
    wrongDay: 'ניתן להחתים כניסה רק ביום שבו המשמרת מתוכננת.',
    startTooEarly: 'ניתן להחתים כניסה החל מ-{{minutes}} דקות לפני תחילת המשמרת.',
    alreadyStarted: 'המשמרת כבר החלה.',
    alreadyFinished: 'המשמרת כבר הסתיימה.',
    notStarted: 'המשמרת עדיין לא החלה.',
    finishTooLate: 'לא ניתן להחתים יציאה יותר מ-{{minutes}} דקות לאחר סיום המשמרת.',
    outOfRange: 'עליך להיות בסניף כדי להחתים כניסה או יציאה.',
    breakTooSoon: 'ניתן לצאת להפסקה החל מ-{{minutes}} דקות לאחר תחילת המשמרת.',
    breakLimit: 'כבר ניצלת את שתי ההפסקות של המשמרת.',
    breakAlreadyActive: 'אתה כבר בהפסקה.',
    breakNotActive: 'אינך בהפסקה כרגע.',
    breakEndTooSoon: 'הפסקה חייבת להימשך לפחות {{minutes}} דקות לפני שניתן לסיים אותה.',
  },
  units: {
    meters: '{{value}} מטר',
    feet: '{{value}} רגל',
  },
};
