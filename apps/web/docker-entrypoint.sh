#!/bin/sh
set -e

export PORT="${PORT:-80}"
if [ -n "${API_HOSTPORT:-}" ]; then
  export API_UPSTREAM="http://${API_HOSTPORT}"
else
  export API_UPSTREAM="${API_UPSTREAM:-http://api:3000}"
fi

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
