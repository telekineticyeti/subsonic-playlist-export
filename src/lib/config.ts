if (
  !process.env.subsonic_server_host ||
  !process.env.subsonic_server_user ||
  !process.env.subsonic_server_password
) {
  throw new Error('Incomplete configuration');
}

if (!process.env.playlistIds) {
  throw new Error('Incomplete configuration - Please specify playlist IDs to export.');
}

const playlistIds = process.env.playlistIds
  .split(',')
  .filter(id => !isNaN(parseInt(id.trim())))
  .map(id => parseInt(id.trim()));

const config = {
  host: {
    address: process.env.subsonic_server_host,
    username: process.env.subsonic_server_user,
    password: process.env.subsonic_server_password,
  },
  playlistIds,
};

export default config;
