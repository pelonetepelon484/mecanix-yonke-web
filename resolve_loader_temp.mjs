import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (err) {
    if (specifier.startsWith('.') && !specifier.match(/\\.[a-z]+$/)) {
      return nextResolve(specifier + '.js', context);
    }
    throw err;
  }
}
`), pathToFileURL('./'));
