# Publicação e recuperação

Em 27/11/2026, a publicação solicitada usa a Vercel para a interface e mantém Cloudflare Workers + D1 para a API e os dados existentes. O endereço público é https://bigcash-two.vercel.app. A senha administrativa e os secrets VAPID existentes foram mantidos.

## Publicação na Vercel

O projeto `bigcash` pertence à equipe `ronald-almeida-4717s-projects` e usa Node.js 24, `npm ci`, `npm run build` e saída `dist`. `vercel.json` encaminha `/api/*` para o Worker existente. Nenhum secret Cloudflare ou senha deve ser copiado para o frontend ou para variáveis `VITE_*`.

O Worker aceita gravações somente da própria origem e dos endereços exatos de `ALLOWED_APP_ORIGINS` em `wrangler.jsonc`. Apenas o domínio de produção da Vercel está autorizado; URLs temporárias de preview não podem gravar no banco real. Não habilite `*.vercel.app`. Ao adicionar um domínio próprio, atualize a lista explicitamente e republique o Worker.

As respostas de API não usam cache da Vercel nem do service worker. O cookie continua `HttpOnly`, `Secure` em HTTPS e `SameSite=Strict`, servido pelo mesmo domínio da interface. Cada domínio exige seu próprio login com a senha existente. Web Push requer nova inscrição no navegador ao mudar de domínio.

Para novas versões, valide o commit, faça o backup e as migrações necessárias, publique o Worker e então a interface na Vercel. Não mude o banco ou os secrets para publicar a interface. O deploy desta entrega é explícito a partir do commit da branch do PR; não foi habilitada publicação automática da branch `main` antiga. A integração Git pode ser ativada após a revisão e merge.

Teste após publicar: HTML e arquivos estáticos com status 200; `/api/operations` sem sessão com 401 JSON; mutação de origem não autorizada com 403. Confirme o login com a senha atual e confira o histórico em Configurações. Nunca execute as fixtures de integração no banco real.

## Preparação

1. Valide a branch com `npm ci`, `npm test` e `npm run build` usando Node.js 24+.
2. Faça a conferência da nova interface em banco local isolado. Para API: `.dev.vars` com a senha exclusiva de teste, migrações locais, `npm run dev` e `npm run test:api`. O teste exige base nova e usa apenas `127.0.0.1:8787`.
3. Combine uma janela sem edições. Confira a identidade/autorização Cloudflare e o banco de destino em `wrangler.jsonc`. O ID existente foi preservado; não crie outro banco de produção por engano.
4. Guarde o SQL de backup fora do repositório e fora de qualquer hospedagem pública. O arquivo contém dados reais, sessões e comprovantes.

## Migração remota protegida

```sh
npm run db:remote -- --backup CAMINHO_PRIVADO_FORA_DO_REPOSITORIO/antes-da-migracao.sql
```

O comando primeiro consulta uma referência Time Travel, exporta o banco completo, restaura o SQL em SQLite em memória, confere integridade e tabelas essenciais e grava um relatório com hash e contagem de registros. Somente depois aplica migrações. Qualquer falha interrompe o processo. Um backup existente não é sobrescrito.

Esse teste prova que o SQL exportado pode ser reconstruído em SQLite; não é uma restauração remota do D1. A referência Time Travel é o caminho preferencial de recuperação do banco existente. Confirme a retenção do plano na [documentação oficial do D1](https://developers.cloudflare.com/d1/reference/time-travel/). A [exportação oficial](https://developers.cloudflare.com/d1/best-practices/import-export-data/) serve como cópia adicional fora da janela de retenção.

Em seguida, publique com o mecanismo existente (`npm run deploy`) e confira login, histórico legado, contas e um fluxo controlado. Não execute o teste de API contra produção. Preserve APP_PASSWORD, VAPID e os demais secrets já configurados; a migração não os substitui.

## Recuperação

- Migrações 0007/0008 são aditivas. Para reverter apenas a interface, uma versão anterior do Worker pode ser republicada, preservando as tabelas novas.
- Após gravar dados novos, a versão antiga não os conhece. Prefira corrigir e republicar a nova versão; não opere os dois modelos em paralelo.
- Uma restauração Time Travel sobrescreve dados e pode descartar alterações posteriores. Antes dela, exporte o estado atual, identifique a referência salva em `.recovery.txt` e obtenha a decisão do responsável. O script nunca restaura produção automaticamente.
- O arquivo `.verified.json` registra hash, contagens e o resultado do teste local de restauração. Mantenha-o junto do SQL e da referência de recuperação em armazenamento privado.

As revisões da operação são divididas em fragmentos para respeitar o [limite oficial de tamanho de linha do D1](https://developers.cloudflare.com/d1/platform/limits/). Os limites de upload e estado são explícitos e falham sem descartar dados.
