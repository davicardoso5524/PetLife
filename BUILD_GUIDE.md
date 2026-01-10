# 🚀 Guia de Build - PetLife

## Pré-requisitos

- Node.js instalado
- Dependências do projeto instaladas (`npm install`)

## Criar Instalador Windows

### Passo 1: Preparar o Projeto

```bash
# Certifique-se de que todas as dependências estão instaladas
npm install
```

### Passo 2: Executar Build

```bash
# Criar instalador Windows
npm run build
```

O processo levará alguns minutos. Você verá mensagens como:
```
• electron-builder  version=26.0.12
• loaded configuration  file=package.json
• building        target=nsis file=dist\PetLife Setup 1.0.0.exe
```

### Passo 3: Localizar o Instalador

Após o build, o instalador estará em:

```
dist/PetLife Setup 1.0.0.exe
```

## Estrutura de Saída

```
dist/
├── PetLife Setup 1.0.0.exe    ← INSTALADOR (distribua este arquivo)
├── win-unpacked/              ← Versão descompactada (para testes)
│   ├── PetLife.exe
│   ├── resources/
│   └── ...
└── builder-debug.yml
```

## Testar o Instalador

1. Execute `PetLife Setup 1.0.0.exe`
2. Siga o assistente de instalação
3. Verifique se:
   - Atalho foi criado na área de trabalho
   - Atalho foi criado no menu iniciar
   - Aplicação abre corretamente
   - Licenciamento funciona

## Distribuir

### Opção 1: GitHub Releases

1. Crie um repositório no GitHub
2. Faça commit e push do código
3. Crie uma release (tag v1.0.0)
4. Faça upload do instalador como asset

### Opção 2: Download Direto

1. Hospede o instalador em um servidor
2. Compartilhe o link direto

## Comandos Úteis

```bash
# Executar em modo desenvolvimento
npm run electron

# Criar build
npm run build

# Limpar build anterior
rm -rf dist/
```

## Solução de Problemas

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "ENOENT: no such file or directory"
Verifique se todos os arquivos estão presentes:
- main.js
- server.js
- public/
- routes/
- services/
- utils/

### Build muito lento
É normal. O electron-builder compacta e empacota tudo. Aguarde.

## Próximos Passos

1. ✅ Build criado com sucesso
2. ✅ Testar instalador
3. ✅ Criar repositório no GitHub
4. ✅ Fazer primeiro commit
5. ✅ Criar release com instalador
6. ✅ Atualizar README com link correto

## Notas Importantes

- O instalador tem ~150-200MB (inclui Node.js e Electron)
- Primeira instalação pode demorar alguns minutos
- Antivírus podem alertar (é normal para apps não assinados)
- Para assinar digitalmente, você precisa de um certificado de código
