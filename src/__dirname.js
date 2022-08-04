import url from 'url';
import path from 'path';

const get__dirname = (_importMeta) => path.dirname(url.fileURLToPath(_importMeta.url));
export default get__dirname(import.meta);
