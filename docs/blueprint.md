# **App Name**: Comanda digital

## Core Features:

- Administração Multi-Restaurante e Usuários: Gerencia o perfil de cada restaurante, incluindo planos e status, garantindo o isolamento completo de dados e as permissões de acesso baseadas em 'restaurantId' para usuários (Admin, Garçom), utilizando a estrutura do Firestore.
- Cardápio Digital Inteligente: Cria e organiza itens de cardápio por categorias, define preços, e atribui um 'setor' para direcionamento de impressão, tudo persistido no Firestore. Inclui uma ferramenta de IA para gerar descrições atraentes dos pratos.
- Comanda por Mesa via QR Code: Cria e gerencia mesas, gerando QR Codes automaticamente para acesso direto do cliente ao cardápio e pedido, sem necessidade de login. Os dados das mesas são armazenados no Firestore.
- Sistema Central de Pedidos: Permite a criação, edição e gestão de pedidos vinculados a mesas ou clientes, com um fluxo claro de status (Aberto, Preparando, Pronto, Finalizado, Cancelado), utilizando o Firestore para persistência.
- Impressão Automatizada por Setor: Direciona itens de pedido automaticamente para impressoras específicas (configuradas no Firestore com IP e setores associados), com base no setor definido no cardápio.
- Histórico e Repetição de Pedidos de Clientes: Armazena o histórico de pedidos dos clientes (ligado via 'customerId' na coleção do Firestore) e permite a repetição rápida de pedidos anteriores, especialmente útil para interações via WhatsApp.
- Operação Offline para Garçons: Permite que garçons registrem pedidos offline e sincronizem os dados automaticamente com o sistema quando a conexão à internet for restaurada, garantindo continuidade do serviço.

## Style Guidelines:

- Esquema de cores claro para uma interface limpa e focada. Cor primária: Um verde orgânico e sofisticado (#368C49), para transmitir frescor e organização. Cor de fundo: Um verde-acinzentado muito sutil (#E6F0E6), para amplitude e descanso visual. Cor de destaque: Um verde-amarelado vibrante e fresco (#B8E67E), para realçar ações e informações importantes.
- Fonte principal: 'Inter' (sans-serif) para títulos e corpo do texto. Escolhida pela sua alta legibilidade, modernidade e versatilidade em diversas densidades de informação, ideal para uma plataforma de gerenciamento.
- Ícones: Utilização de um conjunto de ícones minimalistas e claros, em estilo de linha, para fácil reconhecimento de funcionalidades. Ícones preenchidos podem ser usados para estados ativos ou para elementos-chave.
- Layout: Design responsivo, limpo e modular, com foco na organização espacial para facilitar a leitura rápida de pedidos e cardápios. Utiliza cards e listas para estruturar informações de forma acessível.
- Animações: Transições e micro-interações suaves para guiar o usuário e fornecer feedback instantâneo sobre suas ações (ex: confirmação de item adicionado, mudança de status do pedido), mantendo a performance da aplicação.