import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "../api/eonet";

const ONE_DAY = 24 * 60 * 60 * 1000;

export function useCategories() {
  return useQuery({
    queryKey: ["eonet", "categories"],
    queryFn: fetchCategories,
    staleTime: ONE_DAY, // categories rarely change
  });
}
