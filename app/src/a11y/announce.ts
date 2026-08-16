import { AccessibilityInfo } from 'react-native';

/**
 * Speak a message to a screen reader without moving focus.
 *
 * Clock-in is a fire-and-forget action: on success the card quietly changes, and
 * a failure shows an inline banner the user may never focus. Neither is announced
 * by default, so a VoiceOver / TalkBack user gets no feedback that anything
 * happened. This closes that gap. It is a no-op when no screen reader is running.
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
