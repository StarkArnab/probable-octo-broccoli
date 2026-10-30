#!/usr/bin/env python3
"""Run SQL regression tests in a disposable, network-isolated PostgreSQL container."""
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGE = 'postgres:17.7-alpine'


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], check=True, **kwargs)


def main():
    name = f'orbit-rls-{uuid.uuid4().hex[:12]}'
    try:
        docker('run', '--detach', '--name', name, '--network', 'none',
               '--tmpfs', '/var/lib/postgresql/data',
               '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE,
               stdout=subprocess.DEVNULL)
        # The image's temporary init server accepts Unix sockets only.
        # Wait for the final TCP server, and use that same transport for SQL.
        for _ in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready',
                                    '-h', '127.0.0.1', '-U', 'postgres'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('Disposable PostgreSQL did not become ready')
        files = [ROOT / 'tests/database/bootstrap.sql',
                 ROOT / 'supabase/migrations/202610300001_personal_kanban.sql',
                 ROOT / 'supabase/migrations/202610300002_bind_owner_user_id.sql',
                 ROOT / 'tests/database/rls.sql']
        for path in files:
            print(f'Applying {path.relative_to(ROOT)}', flush=True)
            docker('exec', '-i', name, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres',
                   '-v', 'ON_ERROR_STOP=1', input=path.read_text(), text=True)
        print('RLS regression checks passed (disposable database only).')
    finally:
        subprocess.run(['docker', 'rm', '--force', name],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
