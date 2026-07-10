import { createClient } from "@supabase/supabase-js";

(async () => {
  const url = "https://knfavumgmixbdxmqlspg.supabase.co";
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZmF2dW1nbWl4YmR4bXFsc3BnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzY4MzMzMiwiZXhwIjoyMDk5MjU5MzMyfQ.cqPkFhIj4iy8uYAbtarKqDRaW0GPnsPQ_MoEi-i2QYE";

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre")
    .in("nombre", ["Gloria Roa", "Alberto Garrido"]);

  data?.forEach((u) => {
    console.log(`${u.nombre}|${u.id}`);
  });
})();
