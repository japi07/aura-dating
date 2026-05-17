import { Slot } from 'expo-router';

// Use Slot so router.back() bubbles up to the root navigator.
export default function ProfileLayout() {
  return <Slot />;
}
