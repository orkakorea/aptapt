const { data, error, count } = await supabase
  .from("raw_places")
  .select("*", { count: "exact", head: false })
  .limit(5);
