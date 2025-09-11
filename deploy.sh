#!/bin/bash

echo "🚀 Deploy do Frontend Next.js..."

# Verificar se estamos na pasta correta
if [ ! -f "next.config.mjs" ]; then
    echo "❌ Erro: Execute este script na pasta raiz do projeto (onde está o next.config.mjs)"
    exit 1
fi

# Limpar cache do Next.js
echo "🧹 Limpando cache do Next.js..."
rm -rf .next
rm -rf out
rm -rf node_modules/.cache

# Instalar dependências do frontend
echo "📦 Instalando dependências do frontend..."
npm ci

# Build do frontend
echo "🔨 Fazendo build do frontend..."
NODE_ENV=production npm run build

# Verificar se o build foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Build do frontend concluído com sucesso!"
    echo "📁 Arquivos gerados em: .next/"
else
    echo "❌ Erro no build do frontend"
    exit 1
fi

# Opcional: Build das Firebase Functions
echo "🔥 Fazendo build das Firebase Functions..."
cd functions
npm ci
npm run build
cd ..

echo "🎉 Deploy completo!"
