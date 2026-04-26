module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    function ({ types: t }) {
      return {
        visitor: {
          MemberExpression(path) {
            const { node } = path;
            if (
              node.object.type === 'MetaProperty' &&
              node.object.meta.name === 'import' &&
              node.object.property.name === 'meta' &&
              node.property.name === 'env'
            ) {
              path.replaceWith(
                t.memberExpression(t.identifier('process'), t.identifier('env'))
              );
            }
          },
        },
      };
    },
  ],
};
