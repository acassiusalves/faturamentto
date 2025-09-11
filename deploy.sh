#!/bin/bash

echo "🚀 Iniciando processo de deploy..."

# Limpar cache e dependências
echo "🧹 Limpando cache..."
rm -rf .next
rm -rf node_modules
rm -rf .npm-cache

# Instalar dependências
echo "📦 Instalando dependências..."
npm ci --production=false

# Verificar tipos TypeScript
echo "🔍 Verificando tipos..."
npm run typecheck || {
    echo "❌ Erro de TypeScript encontrado. Build interrompido."
    exit 1
}

# Build do projeto
echo "🔨 Fazendo build..."
npm run build

echo "✅ Deploy concluído com sucesso!"
