#!/bin/bash
# wait-for-postgres.sh

set -e

host="$1"
shift
cmd="$@"

until PGPASSWORD=scrappypulpitgourdehinders psql -h "$host" -U "chesster" -d "chesster" -c '\q'; do
	>&2 echo "Postgres is unavailable - sleeping"
	sleep 1
done

>&2 echo "Postgres is up - executing command"
exec $cmd
