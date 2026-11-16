import { defineMarkdocConfig, Markdoc, nodes } from '@astrojs/markdoc/config'

export default defineMarkdocConfig({
  nodes: {
    paragraph: {
      ...nodes.paragraph,
      transform(node, config) {
        const inline = node.children.length === 1 && node.children[0]
        const image = inline?.type === 'inline' && inline.children.length === 1 && inline.children[0]

        // Only standalone images become figures, keeping inline images valid
        // and avoiding invalid <figure> elements nested inside paragraphs.
        if (image?.type === 'image') {
          const { title, ...attributes } = image.transformAttributes(config)
          return new Markdoc.Tag('figure', { class: 'article-figure' }, [
            new Markdoc.Tag('img', { ...attributes, loading: 'lazy', decoding: 'async' }),
            ...(title ? [new Markdoc.Tag('figcaption', {}, [title])] : []),
          ])
        }

        return new Markdoc.Tag('p', node.transformAttributes(config), node.transformChildren(config))
      },
    },
  },
})
