import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    let payload = value;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        // keep original payload
      }
    }

    const parsed = this.schema.safeParse(payload);

    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("zod validation failed payload", payload);
        // eslint-disable-next-line no-console
        console.log("zod validation issues", parsed.error.flatten());
      }
      throw new BadRequestException({
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    return parsed.data;
  }
}
