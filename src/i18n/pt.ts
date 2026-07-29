/**
 * Portuguese is the source dictionary: every key exists here, and the other
 * languages are checked against it at build time.
 *
 * Keys are namespaced by screen so a translator can work one screen at a time.
 */
export const pt = {
  // --- navigation and shell -------------------------------------------------
  "nav.map": "Mapa",
  "nav.destinations": "Destinos",
  "nav.forBusiness": "Para empresas",
  "nav.messages": "Mensagens",
  "nav.bookings": "Reservas",
  "nav.notifications": "Notificações",
  "nav.alerts": "Avisos",
  "nav.profile": "Perfil",
  "nav.help": "Ajuda",
  "nav.search": "Buscar",
  "nav.dashboard": "Painel",
  "nav.feed": "Seguindo",
  "nav.skipToContent": "Pular para o conteúdo",
  "nav.home": "Avena — página inicial",
  "nav.main": "Navegação principal",
  "nav.moreOptions": "Mais opções",
  "nav.language": "Idioma",

  "footer.terms": "Termos de Uso",
  "footer.privacy": "Política de Privacidade",
  "footer.help": "Central de ajuda",
  "footer.myData": "Meus dados",
  "footer.cookies": "Preferências de cookies",

  "common.back": "Voltar",
  "common.backToMap": "Voltar ao mapa",
  "common.backToProfile": "Voltar ao perfil",
  "common.cancel": "Cancelar",
  "common.save": "Salvar",
  "common.saveChanges": "Salvar alterações",
  "common.delete": "Excluir",
  "common.edit": "Editar",
  "common.remove": "Remover",
  "common.close": "Fechar",
  "common.people": "pessoas",
  "common.person": "pessoa",
  "common.reviews": "avaliações",
  "common.review": "avaliação",
  "common.from": "A partir de",
  "common.loading": "Carregando…",
  "common.notFound": "Não encontrado.",
  "common.optional": "opcional",

  // --- offline and storage --------------------------------------------------
  "offline.message":
    "Você está sem internet. Dá para registrar experiências e ver suas reservas normalmente — o mapa mostra só as áreas já carregadas.",
  "storage.full":
    "O armazenamento deste navegador ficou cheio. Suas últimas alterações não foram salvas. Faça um backup em Perfil › Meus dados e remova algumas fotos.",
  "storage.open": "Abrir Meus dados",

  // --- home -----------------------------------------------------------------
  "home.searchPlaceholder": "Para onde você vai? Busque passeios",
  "home.searchLabel": "Buscar destino",
  "home.search": "Buscar",
  "home.timeline": "Linha do tempo",
  "home.noExperiences": "Nenhuma experiência encontrada.",
  "home.allCategories": "Todas categorias",
  "home.allPeople": "Todas pessoas",
  "home.allYears": "Todos anos",
  "home.newExperience": "Registrar nova experiência",
  "home.emptyTitle": "Comece a colecionar suas viagens",
  "home.emptyText":
    "O Avena guarda no mapa cada lugar que você viveu — com fotos, com quem estava junto e com o que valeu a pena — e mostra os passeios, guias e restaurantes de quem já foi avaliado pela comunidade.",
  "home.emptyCtaTitle": "Já viajou antes?",
  "home.emptyCtaText":
    "Registre uma viagem que você já fez e ela vira o primeiro pin do seu mapa afetivo.",
  "home.emptyCtaButton": "Registrar minha primeira memória",

  // --- destinations / search ------------------------------------------------
  "destination.title": "Passeios, hotéis e restaurantes pelo Brasil",
  "destination.subtitle":
    "Busque por cidade, nome da agência ou do passeio e reserve com quem já foi avaliado pela comunidade.",
  "destination.placeholder": "Destino, agência ou passeio",
  "destination.searchLabel": "Buscar destino, agência ou passeio",
  "destination.all": "Todos",
  "destination.accessibility": "Acessibilidade:",
  "destination.results": "{count} resultados em {query}",
  "destination.resultsOne": "{count} resultado em {query}",
  "destination.noResults": "Ainda não temos parceiros cadastrados para {query}.",
  "destination.didYouMean": "Você quis dizer:",
  "destination.searchHint":
    "Você também pode buscar pelo estado (por exemplo, RJ ou Minas Gerais) ou pela região (Nordeste, Sul).",
  "destination.partners": "parceiros",
  "destination.itineraryTitle": "Roteiro de {days} dias em {city}",
  "destination.itineraryTitleOne": "Roteiro de 1 dia em {city}",
  "destination.itinerarySubtitle":
    "Montado a partir de {count} experiências que viajantes registraram nesta cidade.",
  "destination.day": "Dia {n}",

  // --- business -------------------------------------------------------------
  "business.sendMessage": "Enviar mensagem",
  "business.about": "Sobre",
  "business.contact": "Contato",
  "business.tours": "Passeios disponíveis",
  "business.travelerReviews": "Avaliações de viajantes",
  "business.recommendPct": "{pct}% recomendam",
  "business.suspended":
    "Esta empresa está suspensa e não está recebendo novas reservas.",
  "business.verified": "Verificada pelo Avena — documentação conferida",
  "business.cadastur": "Cadastur {number} — registrado no Ministério do Turismo",
  "business.recommends": "Recomenda",
  "business.doesNotRecommend": "Não recomenda",
  "business.bestSeason": "Melhor época: {season}",
  "business.seasonLeft": "restam {count} meses de temporada",
  "business.seasonLeftOne": "resta 1 mês de temporada",
  "business.effort": "Esforço {level}",
  "business.cancellation": "Cancelamento {policy}",
  "business.spotsToday": "{remaining} de {capacity} vagas hoje",
  "business.noSpotsToday": "Sem vagas hoje",

  // --- reputation -----------------------------------------------------------
  "reputation.none": "Sem avaliações ainda",
  "reputation.few": "Poucas avaliações",
  "reputation.excellent": "Excelente",
  "reputation.veryGood": "Muito bom",
  "reputation.good": "Bom",
  "reputation.average": "Regular",
  "reputation.poor": "Ruim",

  // --- booking --------------------------------------------------------------
  "booking.book": "Reservar",
  "booking.date": "Data",
  "booking.travelers": "Pessoas",
  "booking.goToPayment": "Ir para o pagamento",
  "booking.total": "Valor total",
  "booking.serviceFee": "Taxa de serviço Avena ({pct}%): R$ {amount}",
  "booking.businessReceives": "{name} recebe: R$ {amount}",
  "booking.businessReceived": "{name} recebeu: R$ {amount}",
  "booking.holdNotice":
    "A vaga fica reservada por {minutes} minutos até o pagamento. A reserva só é confirmada depois que o pagamento é aprovado.",
  "booking.spotsAvailable": "{remaining} de {capacity} vagas disponíveis nesta data.",
  "booking.soldOut": "Sem vagas disponíveis nesta data.",
  "booking.onlyLeft":
    "Só restam {remaining} vagas nesta data para o número de pessoas informado.",
  "booking.offSeason":
    "Melhor época para este passeio: {season}. Fora da temporada a experiência pode ser diferente do anunciado.",
  "booking.waitlistOffer": "Podemos avisar você se alguém cancelar nesta data.",
  "booking.waitlistJoin": "Avisar se abrir vaga",
  "booking.waitlistJoined":
    "Você está na lista de espera desta data. Avisamos se abrir vaga.",
  "booking.participants": "Quem vai participar",
  "booking.participantsWhy":
    "A agência precisa do nome e documento de cada pessoa para lista de embarque, entrada em parques e seguro.",

  // --- payment --------------------------------------------------------------
  "payment.title": "Pagamento",
  "payment.myBookings": "Minhas reservas",
  "payment.demoTitle": "Ambiente de demonstração.",
  "payment.demoText":
    "Nenhuma cobrança é feita e nenhum dado de cartão é solicitado ou armazenado. Na versão de produção esta tela leva ao provedor de pagamento, que divide o valor entre a agência e a Avena automaticamente.",
  "payment.method": "Forma de pagamento",
  "payment.pix": "Pix",
  "payment.card": "Cartão de crédito",
  "payment.pay": "Pagar R$ {amount}",
  "payment.processing": "Processando…",
  "payment.timeLeft":
    "Você tem {minutes} minutos para concluir antes que a vaga volte para o passeio.",
  "payment.approved": "Pagamento aprovado em {date}. Comprovante {reference}.",
  "payment.notFound": "Reserva não encontrada",
  "payment.seeBookings": "Ver minhas reservas",

  // --- bookings list --------------------------------------------------------
  "bookings.title": "Minhas reservas",
  "bookings.empty":
    "Nenhuma reserva ainda. Explore os destinos e feche passeios direto pelo app.",
  "bookings.awaiting": "Aguardando pagamento",
  "bookings.upcoming": "Próximas",
  "bookings.past": "Anteriores",
  "bookings.payNow": "Pagar e confirmar · faltam {minutes} min",
  "bookings.expiredNote":
    "A vaga voltou para o passeio. Você pode reservar de novo na página da agência.",
  "bookings.talkTo": "Falar com {name}",
  "bookings.openTicket": "Abrir chamado com a Avena",
  "bookings.cancel": "Cancelar reserva",
  "bookings.confirmCancel": "Confirmar cancelamento",
  "bookings.refundAmount": "Você receberá de volta R$ {amount} ({pct}% do valor pago).",
  "bookings.refunded": "Reembolsado: R$ {amount}",
  "bookings.paidVia": "Pago via {method} · comprovante {reference}",

  "status.aguardando-pagamento": "Aguardando pagamento",
  "status.confirmada": "Confirmada",
  "status.expirada": "Expirada",
  "status.cancelada": "Cancelada",
  "statusHint.aguardando-pagamento":
    "A vaga está reservada para você, mas só é confirmada com o pagamento.",
  "statusHint.confirmada":
    "Pagamento aprovado. A agência recebeu sua lista de participantes.",
  "statusHint.expirada": "O prazo de pagamento passou e a vaga voltou para o passeio.",
  "statusHint.cancelada": "Reserva cancelada.",

  // --- notifications --------------------------------------------------------
  "notifications.title": "Notificações",
  "notifications.subtitle":
    "O Avena avisa quando um passeio acontece, quando é hora de avaliar quem te atendeu e quando vale registrar a memória no seu mapa.",
  "notifications.empty":
    "Nenhuma notificação por enquanto. Assim que um passeio seu terminar, ele aparece aqui.",
  "notifications.dismiss": "Dispensar",

  // --- profile --------------------------------------------------------------
  "profile.editProfile": "Editar perfil",
  "profile.myData": "Meus dados e backup",
  "profile.switchAccount": "Trocar tipo de conta",
  "profile.signOut": "Sair",
  "profile.confirmSignOut": "Sair da conta?",
  "profile.public": "Público",
  "profile.private": "Privado",
  "profile.tourist": "Turista",
  "profile.professional": "Profissional",
  "profile.experiences": "experiências",
  "profile.cities": "cidades",
  "profile.people": "pessoas",
  "profile.followers": "seguidores",
  "profile.following": "seguindo",
  "profile.yearRetrospective": "Ver retrospectiva do ano",

  // --- follow ---------------------------------------------------------------
  "follow.follow": "Seguir",
  "follow.unfollow": "Deixar de seguir",
  "follow.requested": "Solicitação enviada",
  "follow.requestPrivate": "Solicitar para seguir",
  "follow.privateProfile": "Este perfil é privado",
  "follow.privateExplain":
    "Só quem {name} aceita como seguidor vê as experiências e os passeios deste perfil.",
  "follow.travelers": "Viajantes",
  "follow.discoverTitle": "Viajantes para seguir",
  "follow.discoverSubtitle":
    "Siga quem viaja parecido com você e acompanhe os passeios que estão fazendo.",
  "follow.feedTitle": "Quem você segue",
  "follow.feedSubtitle":
    "As experiências e os passeios mais recentes de quem você acompanha.",
  "follow.feedEmpty":
    "Você ainda não segue ninguém. Encontre viajantes e acompanhe o que estão fazendo.",
  "follow.feedNoActivity":
    "Quem você segue ainda não publicou nada. Assim que publicarem, aparece aqui.",
  "follow.findTravelers": "Encontrar viajantes",
  "follow.isTravelling": "está viajando agora",
  "follow.bookedTour": "reservou {tour} com {business}",
  "follow.registeredMemory": "registrou {title} em {place}",
  "follow.followsYou": "Segue você",
  "follow.noFollowers": "Ninguém segue este perfil ainda.",
  "follow.noFollowing": "Este perfil ainda não segue ninguém.",

  // --- support --------------------------------------------------------------
  "support.title": "Central de ajuda",
  "support.subtitle":
    "Este canal fala com a Avena, não com a agência. Use quando o problema for com a reserva, com a cobrança ou com o próprio atendimento de quem te vendeu o passeio.",
  "support.subject": "Assunto",
  "support.relatedBooking": "Reserva relacionada (opcional)",
  "support.none": "Nenhuma",
  "support.whatHappened": "O que aconteceu",
  "support.placeholder":
    "Conte com o máximo de detalhes: datas, valores e o que já tentou resolver com a agência.",
  "support.open": "Abrir chamado",
  "support.protocolCreated":
    "Chamado aberto com o protocolo {protocol}. Guarde esse número: ele identifica o seu caso em qualquer contato.",
  "support.myTickets": "Meus chamados",
  "support.noTickets": "Você ainda não abriu nenhum chamado.",
  "support.protocolOpened": "Protocolo {protocol} · aberto em {date}",
  "support.reply": "Resposta da Avena",
  "support.status.aberto": "Aberto",
  "support.status.respondido": "Respondido",
  "support.status.resolvido": "Resolvido",
  "support.subject.booking": "Problema com uma reserva",
  "support.subject.billing": "Cobrança ou reembolso",
  "support.subject.noShow": "Agência ou guia não compareceu",
  "support.subject.report": "Denúncia de conteúdo",
  "support.subject.account": "Minha conta e meus dados",
  "support.subject.other": "Outro assunto",

  // --- my data --------------------------------------------------------------
  "myData.title": "Meus dados",
  "myData.warningTitle": "Seus dados estão apenas neste navegador.",
  "myData.warningText":
    "Ainda não existe conta com login nesta versão, então limpar os dados do navegador, trocar de aparelho ou usar uma janela anônima faz suas memórias desaparecerem. Faça o backup abaixo e guarde o arquivo.",
  "myData.storageTitle": "Espaço usado por fotos",
  "myData.storageUsed":
    "{used} de aproximadamente {total} disponíveis neste navegador ({pct}%).",
  "myData.storageWarning":
    "Está perto do limite: faça o backup e remova fotos de memórias antigas.",
  "myData.backup": "Backup",
  "myData.download": "Baixar backup",
  "myData.restore": "Restaurar backup",
  "myData.confirmRestore":
    "Restaurar o backup substitui tudo o que está no app agora. Deseja continuar?",
  "myData.downloaded":
    "Backup salvo. Guarde o arquivo em outro lugar além deste aparelho.",
  "myData.restored": "Backup restaurado.",
  "myData.invalidFile": "Este arquivo não parece ser um backup do Avena.",
  "myData.rightsTitle": "Seus direitos",
  "myData.bookings": "reservas",
  "myData.rightsText":
    "A LGPD garante que você acesse, corrija e apague seus dados. O botão de backup entrega tudo o que o app guarda sobre você em formato aberto. Para apagar, limpe os dados do navegador. Detalhes na",

  // --- photos ---------------------------------------------------------------
  "cancel.flexivel": "Flexível",
  "cancel.moderada": "Moderada",
  "cancel.rigida": "Rígida",
  "cancel.flexivelText": "Reembolso total até 24h antes do passeio.",
  "cancel.moderadaText": "Reembolso total até 3 dias antes; depois disso, 50% de reembolso.",
  "cancel.rigidaText": "Reembolso total até 7 dias antes; depois disso, sem reembolso.",

  "participants.leadBooker": "Responsável pela reserva",
  "participants.number": "Participante {n}",
  "participants.fullName": "Nome completo",
  "participants.asOnDocument": "Como está no documento",
  "participants.docType": "Tipo",
  "participants.document": "Documento",
  "participants.docNumber": "Número",
  "participants.birthDate": "Nascimento (opcional)",
  "participants.nameRequired": "Informe o nome do participante {n}",
  "participants.docRequired": "Informe o documento",
  "participants.cpfInvalid": "CPF inválido",
  "participants.docTooShort": "Documento muito curto",
  "participants.duplicateDocs": "Há documentos repetidos entre os participantes",

  "photos.label": "Fotos",
  "photos.add": "Adicionar foto",
  "photos.processing": "Processando…",
  "photos.count": "{count} de {max} fotos",
  "photos.autoResized":
    "As imagens são reduzidas automaticamente para caber no seu aparelho.",
  "photos.removeOne": "Remover foto {n}",
  "photos.notAnImage": "Escolha um arquivo de imagem (JPG, PNG ou HEIC).",
  "photos.readError": "Não foi possível ler esta imagem.",

  // --- banners --------------------------------------------------------------
  "banner.responsibleTitle": "O Avena é a favor do turismo responsável",
  "banner.responsibleText":
    "Respeite a natureza, a cultura e as comunidades que recebem você. Prefira guias registrados no Cadastur, não alimente nem toque em animais silvestres e leve seu lixo de volta.",
  "banner.learnMore": "Saiba mais",
  "banner.advertisement": "Publicidade",

  // --- language -------------------------------------------------------------
  "language.title": "Idioma",
  "language.change": "Mudar idioma",
  "language.notice":
    "As telas para empresas, o painel administrativo e os documentos legais permanecem em português, porque valem sob a lei brasileira.",
} as const;
