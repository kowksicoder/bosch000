-- Backfill creator avatars from users table when missing
update creators c
set avatar = u.avatar_url
from users u
where (c.avatar is null or c.avatar = '')
  and u.avatar_url is not null
  and u.avatar_url <> ''
  and (
    (c.privy_id is not null and u.privy_id = c.privy_id)
    or (c.address is not null and u.wallet_address = c.address)
    or (c.email is not null and u.email = c.email)
  );
