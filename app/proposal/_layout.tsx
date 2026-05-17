import { Slot } from 'expo-router';

// Use Slot so router.back() bubbles up to the root navigator
// (which actually has history) instead of dying inside a one-screen Stack.
export default function ProposalLayout() {
  return <Slot />;
}
