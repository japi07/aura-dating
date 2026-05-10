import { Slot } from 'expo-router';

// Slot (no inner Stack) so back actions bubble up to the root navigator
// instead of dead-ending inside a one-screen nested stack.
export default function EventsLayout() {
  return <Slot />;
}
