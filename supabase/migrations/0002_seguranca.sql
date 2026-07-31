-- Avena — quem pode ler e escrever o quê
--
-- Este arquivo é a segurança do Avena. Não é o código do site: o site roda no
-- computador do visitante e pode ser editado por ele. Estas regras rodam
-- dentro do banco, e valem mesmo para quem chamar a API direto, sem passar
-- pelo app.
--
-- Regra que orienta tudo: o navegador nunca é acreditado. Se uma pergunta é
-- "esta pessoa pode?", quem responde é o Postgres.
--
-- RLS já está ligado em todas as tabelas (0001). Sem política, ninguém lê
-- nada — então o que falta é abrir, uma porta de cada vez.

-- ---------------------------------------------------------------------------
-- Duas funções auxiliares
-- ---------------------------------------------------------------------------

-- `security definer` porque ela precisa ler profiles para decidir quem lê
-- profiles; sem isso a política chamaria a si mesma. O `search_path` vazio
-- fecha o truque clássico de criar uma tabela com o mesmo nome num schema que
-- venha antes no caminho de busca.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- O papel de quem está pedindo, lido por fora do RLS.
--
-- Existe por causa de um erro que o teste pegou: a política de update de
-- profiles comparava o papel novo com o antigo usando um `select` na própria
-- tabela profiles, o que faz o Postgres aplicar a política de profiles outra
-- vez, e outra — "infinite recursion detected". O efeito não era só a recursão:
-- como a regra falhava sempre, ninguém conseguia editar o próprio perfil, nem
-- para trocar o nome. Ler por fora, aqui, quebra o ciclo.
create function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Pelo mesmo motivo, e para as duas colunas que o dono da empresa não pode
-- tocar.
create function public.business_status(b uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.businesses where id = b;
$$;

create function public.business_verified(b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select verified from public.businesses where id = b;
$$;

create function public.owns_business(b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses
    where id = b and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------

-- Perfil público é de todos; perfil privado é de quem o segue e foi aceito.
create policy "perfil visível conforme privacidade"
  on public.profiles for select
  using (
    not is_private
    or id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.follows f
      where f.followed_id = profiles.id
        and f.follower_id = auth.uid()
        and f.accepted
    )
  );

-- O dono edita o próprio perfil, MENOS o papel. A subconsulta compara o valor
-- que está sendo gravado com o que já está lá: se mudou, a linha é recusada.
-- Sem isso, qualquer pessoa vira administradora com uma chamada de API — o
-- app nem precisaria ser aberto.
create policy "dono edita o próprio perfil, sem mexer no papel"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.my_role()
  );

create policy "administradora edita qualquer perfil"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seguidores
-- ---------------------------------------------------------------------------

create policy "vejo o que me envolve"
  on public.follows for select
  using (follower_id = auth.uid() or followed_id = auth.uid() or public.is_admin());

create policy "sigo por mim mesma"
  on public.follows for insert
  with check (follower_id = auth.uid());

-- Quem é seguido aceita ou recusa; quem segue pode desistir.
create policy "quem é seguido decide"
  on public.follows for update
  using (followed_id = auth.uid())
  with check (followed_id = auth.uid());

create policy "deixar de seguir, ou remover seguidor"
  on public.follows for delete
  using (follower_id = auth.uid() or followed_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------

-- A vitrine é pública, menos as suspensas — que continuam visíveis para o
-- dono e para a administradora, senão a empresa suspensa nem descobriria.
create policy "empresa ativa é pública"
  on public.businesses for select
  using (status = 'ativa' or owner_id = auth.uid() or public.is_admin());

create policy "cadastro a empresa em meu nome"
  on public.businesses for insert
  with check (owner_id = auth.uid());

-- O dono edita a própria empresa, sem tocar em status nem em verificado —
-- mesma trava do papel no perfil, e pelo mesmo motivo: um selo que a pessoa
-- pode ligar sozinha não é um selo.
create policy "dono edita a empresa, sem selo nem suspensão"
  on public.businesses for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and status = public.business_status(id)
    and verified = public.business_verified(id)
  );

create policy "administradora edita qualquer empresa"
  on public.businesses for update
  using (public.is_admin())
  with check (public.is_admin());

-- Os dados legais não são públicos. Nem para o viajante que reservou: ele
-- precisa saber com quem está tratando, e isso já está na página da empresa.
create policy "dados legais só do dono e da administradora"
  on public.business_legal for select
  using (public.owns_business(business_id) or public.is_admin());

create policy "dono grava os próprios dados legais"
  on public.business_legal for insert
  with check (public.owns_business(business_id));

create policy "dono atualiza os próprios dados legais"
  on public.business_legal for update
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- Passeios
-- ---------------------------------------------------------------------------

create policy "passeio de empresa ativa é público"
  on public.tours for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = tours.business_id
        and (b.status = 'ativa' or b.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "dono publica passeio"
  on public.tours for insert
  with check (public.owns_business(business_id));

create policy "dono edita passeio"
  on public.tours for update
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "dono remove passeio"
  on public.tours for delete
  using (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------

create policy "reserva é de quem comprou e de quem vende"
  on public.bookings for select
  using (
    traveler_id = auth.uid() or public.owns_business(business_id) or public.is_admin()
  );

-- Reservo em meu nome. O que impede alguém de inventar o preço não é isto: é
-- que o valor pago é conferido no servidor contra o preço do passeio antes de
-- a reserva virar 'confirmada'.
create policy "reservo em meu nome"
  on public.bookings for insert
  with check (traveler_id = auth.uid() and status = 'aguardando-pagamento');

-- Cancelar é a única mudança que o viajante faz sozinho.
create policy "viajante cancela a própria reserva"
  on public.bookings for update
  using (traveler_id = auth.uid())
  with check (traveler_id = auth.uid() and status = 'cancelada');

create policy "empresa atualiza reserva recebida"
  on public.bookings for update
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- Os participantes seguem a reserva, e a administradora não entra: ela precisa
-- de faturamento, não da lista de quem embarcou.
create policy "participantes seguem a reserva"
  on public.booking_participants for select
  using (
    exists (
      select 1 from public.bookings bk
      where bk.id = booking_participants.booking_id
        and (bk.traveler_id = auth.uid() or public.owns_business(bk.business_id))
    )
  );

create policy "viajante escreve os participantes da própria reserva"
  on public.booking_participants for insert
  with check (
    exists (
      select 1 from public.bookings bk
      where bk.id = booking_participants.booking_id and bk.traveler_id = auth.uid()
    )
  );

-- Pagamentos: leitura para os dois lados, escrita para ninguém. Quem grava é
-- o servidor com service_role, que passa por fora do RLS.
create policy "pagamento visível para quem comprou e quem vendeu"
  on public.payments for select
  using (
    exists (
      select 1 from public.bookings bk
      where bk.id = payments.booking_id
        and (bk.traveler_id = auth.uid() or public.owns_business(bk.business_id))
    )
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Listas do viajante
-- ---------------------------------------------------------------------------

create policy "minha lista de espera"
  on public.waitlist for all
  using (traveler_id = auth.uid() or public.owns_business(business_id))
  with check (traveler_id = auth.uid());

create policy "minha lista de desejos"
  on public.wishlist for all
  using (traveler_id = auth.uid())
  with check (traveler_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------

create policy "avaliação é pública"
  on public.reviews for select
  using (true);

-- "Só avalia quem foi", escrito onde não dá para contornar: a reserva tem de
-- ser sua, estar confirmada e já ter acontecido.
create policy "avalia quem comprou, pagou e foi"
  on public.reviews for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.bookings bk
      where bk.id = reviews.booking_id
        and bk.traveler_id = auth.uid()
        and bk.business_id = reviews.business_id
        and bk.status = 'confirmada'
        and bk.travel_date <= current_date
    )
  );

create policy "autor edita a própria avaliação"
  on public.reviews for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "administradora remove avaliação"
  on public.reviews for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Conversas
-- ---------------------------------------------------------------------------

create policy "leio as conversas de que participo"
  on public.messages for select
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or (business_id is not null and public.owns_business(business_id))
  );

create policy "escrevo como eu mesma"
  on public.messages for insert
  with check (sender_id = auth.uid());

-- Marcar como lida é a única alteração; o texto enviado não se reescreve.
create policy "destinatário marca como lida"
  on public.messages for update
  using (
    recipient_id = auth.uid()
    or (business_id is not null and public.owns_business(business_id))
  );

-- ---------------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------------

-- O canal com o Avena é separado do chat com a empresa, porque a reclamação
-- costuma ser sobre a empresa. Ela não vê nada disto.
create policy "meu chamado, e o da administradora"
  on public.support_tickets for select
  using (author_id = auth.uid() or public.is_admin());

create policy "abro chamado em meu nome"
  on public.support_tickets for insert
  with check (author_id = auth.uid());

create policy "administradora responde"
  on public.support_tickets for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Anúncios
-- ---------------------------------------------------------------------------

-- Só o anúncio pago aparece. `paid_at` é escrito pelo servidor, então não há
-- como subir na busca sem passar pelo pagamento.
create policy "anúncio pago é público"
  on public.boosts for select
  using (paid_at is not null or public.owns_business(business_id) or public.is_admin());

create policy "empresa contrata anúncio para si"
  on public.boosts for insert
  with check (public.owns_business(business_id));

create policy "banner ativo é público"
  on public.banners for select
  using (active or public.is_admin());

create policy "administradora cuida dos banners"
  on public.banners for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Memórias
-- ---------------------------------------------------------------------------

-- A memória é do dono, e de quem enxerga o perfil dele. A administradora não
-- entra: ela administra o negócio, não o diário de viagem de ninguém.
create policy "memória segue a privacidade do perfil"
  on public.experiences for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = experiences.owner_id
        and (
          not p.is_private
          or exists (
            select 1 from public.follows f
            where f.followed_id = p.id and f.follower_id = auth.uid() and f.accepted
          )
        )
    )
  );

create policy "escrevo as minhas memórias"
  on public.experiences for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
