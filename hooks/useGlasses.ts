import { useGlassesContext } from '@/context/GlassesContext';

/**
 * Standard hook to access glasses functionality.
 * Now powered by a global context to ensure all screens share the same data and real-time updates.
 */
export function useGlasses() {
  return useGlassesContext();
}
