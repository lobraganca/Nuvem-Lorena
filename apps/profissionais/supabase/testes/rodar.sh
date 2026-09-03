#!/usr/bin/env bash
# Roda a bateria de testes de banco num Postgres descartável.
#
#   bash supabase/testes/rodar.sh
#
# Cada execução monta um banco NOVO: o schema completo, todas as
# migrations, e depois um teste de cada vez. Banco novo a cada vez é o que
# torna o resultado confiável — testes que rodam sobre a sobra do teste
# anterior passam a depender da ordem, e um dia passam a mentir.
#
# Precisa do Postgres local (ver o README desta pasta). O `initdb` recusa
# rodar como root, então o diretório do banco fica em /var/tmp.
set -u

PORTA=${PORTA:-5433}
SOQUETE=${SOQUETE:-/var/tmp}
BANCO=${BANCO:-testes_ei_$$}
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"

psql -h "$SOQUETE" -p "$PORTA" -U postgres -q -c "drop database if exists $BANCO" >/dev/null 2>&1
psql -h "$SOQUETE" -p "$PORTA" -U postgres -q -c "create database $BANCO" >/dev/null 2>&1 || {
  echo "Não consegui criar o banco. O Postgres está de pé?"
  echo "  su postgres -s /bin/bash -c \"/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pg -o '-k /var/tmp -p $PORTA' -l /var/tmp/pg.log start\""
  exit 1
}

rodar() { psql -h "$SOQUETE" -p "$PORTA" -U postgres -d "$BANCO" -q -f "$1" 2>&1; }

echo "── montando o banco"
rodar "$AQUI/00-ambiente-supabase.sql" | grep -i "^psql.*ERROR" | head -3
rodar "$RAIZ/supabase/banco-completo.sql" | grep -i "^psql.*ERROR" | head -3

# `banco-completo.sql` para na 0051; daí em diante, as migrations em ordem.
for m in $(ls "$RAIZ"/supabase/migrations/*.sql | sort); do
  nome=$(basename "$m")
  case "$nome" in 00[0-4]*|0050*|0051*) continue;; esac
  saida=$(rodar "$m" | grep -i "^psql.*ERROR" | grep -v "pg_cron\|cron\." | head -2)
  [ -n "$saida" ] && { echo "  ERRO em $nome"; echo "$saida" | sed 's/^/    /'; }
done

echo
echo "── testes"
passaram=0; falharam=0; quebrados=""
for t in $(ls "$AQUI"/[0-9][0-9]-*.sql | sort); do
  nome=$(basename "$t")
  case "$nome" in 00-*) continue;; esac
  saida=$(rodar "$t")
  if echo "$saida" | grep -qiE "FALHOU|AINDA FALTA|^psql.*ERROR"; then
    falharam=$((falharam+1))
    quebrados="$quebrados$nome\n"
    echo "  FALHOU  $nome"
    echo "$saida" | grep -iE "FALHOU|AINDA FALTA|^psql.*ERROR" | head -2 | sed 's/^/          /'
  else
    passaram=$((passaram+1))
    echo "  ok      $nome"
  fi
done

psql -h "$SOQUETE" -p "$PORTA" -U postgres -q -c "drop database if exists $BANCO" >/dev/null 2>&1

echo
echo "$passaram passaram, $falharam falharam"
[ "$falharam" -eq 0 ] || { printf "\nquebrados:\n$quebrados"; exit 1; }
