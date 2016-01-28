import rp from 'request-promise';
import urls from './urls';

async function getUuid() {
  const data = await rp(urls.uuid);
  console.log(data);
}

getUuid();
