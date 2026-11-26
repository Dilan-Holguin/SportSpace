#!/bin/sh
set -e

export PORT="${PORT:-80}"
export RESOLVER
RESOLVER="$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)"
RESOLVER="${RESOLVER:-1.1.1.1}"

if [ -n "${API_PUBLIC_URL:-}" ]; then
  export API_UPSTREAM="${API_PUBLIC_URL%/}"
elif [ -n "${API_HOSTPORT:-}" ]; then
  export API_UPSTREAM="http://${API_HOSTPORT}"
else
  export API_UPSTREAM="${API_UPSTREAM:-http://api:3000}"
fi

echo "nginx PORT=${PORT} API_UPSTREAM=${API_UPSTREAM} RESOLVER=${RESOLVER}"

envsubst '${PORT} ${API_UPSTREAM} ${RESOLVER}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
