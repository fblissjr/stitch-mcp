import { z } from 'zod';

export const ProxyOptionsSchema = z.object({
  debug: z.boolean().default(false),
});

export type ProxyOptions = z.infer<typeof ProxyOptionsSchema>;
