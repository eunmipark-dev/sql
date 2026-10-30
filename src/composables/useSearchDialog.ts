import { ref } from 'vue'

const open = ref(false)

export function useSearchDialog() {
  return { open, show: () => (open.value = true) }
}
