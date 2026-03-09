import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("register-charity", "routes/register-charity.tsx"),
] satisfies RouteConfig;
