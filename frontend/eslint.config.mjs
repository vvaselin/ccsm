// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // このプロジェクトの書き方に合わせる：
  //   - 代入やプロパティを桁揃えする（= や : の前に複数の空白）
  //   - 短い処理は 1 行に書く（try { x } catch {}、else { a(); b() } など）
  {
    rules: {
      '@stylistic/no-multi-spaces': 'off',
      '@stylistic/key-spacing': ['error', { mode: 'minimum' }],
      'vue/key-spacing': ['error', { mode: 'minimum' }],
      '@stylistic/max-statements-per-line': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // <p>{{ text }}</p> のような 1 行の要素を許す
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off'
    }
  }
)
