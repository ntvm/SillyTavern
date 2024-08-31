#!/bin/bash

# Устанавливаем точку отсчета
BASE_DIR=$(dirname "$0")

# Определяем директории
DATA_DIR="$BASE_DIR/data"
PUBLIC_DIR="$BASE_DIR/public"
THIRD_PARTY_DIR="$PUBLIC_DIR/scripts/extensions/third-party"

# Получаем имя пользователя, если оно указано
USER=${1:-default-user}

# Полный путь к директории пользователя
USER_DIR="$DATA_DIR/$USER"

# Проверяем, существует ли директория пользователя
if [ ! -d "$USER_DIR" ]; then
  echo "Директория $USER_DIR не существует."
  exit 1
fi

# Переносим папку third-party
if [ -d "$USER_DIR/third-party" ]; then
  mv "$USER_DIR/third-party" "$THIRD_PARTY_DIR"
  echo "Папка third-party перенесена в $THIRD_PARTY_DIR"
else
  echo "Папка third-party не найдена в $USER_DIR"
fi

# Переносим все остальные файлы и папки
for item in "$USER_DIR"/*; do
  if [ -e "$item" ]; then
    mv "$item" "$PUBLIC_DIR"
  fi
done

echo "Все остальные файлы и папки перенесены в $PUBLIC_DIR"
