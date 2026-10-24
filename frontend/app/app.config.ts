export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    }
  },

  // lucide の線は既定で 2px。モック（tokens.html）に合わせて 1.6px にする
  icon: {
    customize: (content: string) => content.replaceAll('stroke-width="2"', 'stroke-width="1.6"')
  }
})
