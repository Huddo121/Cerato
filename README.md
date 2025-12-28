# Cerato

> [!CAUTION]
> I've extracted this library out of a toy project, it's extremely unfinished, untested, limited, experimental code.

Cerato is an experiment where I attempt to make it easy to build end-to-end typesafe APIs in Typescript.

The initial inspiration for this was [tRPC](https://trpc.io/), and my disatisfaction that using tRPC meant giving up on having beautiful APIs.
I also want to avoid the usage of tools like superjson, since they modify the responses in order to carry all the extra information needed to properly parse the response (e.g. dates).

Ideally, a consumer of the API wouldn't be able to tell that these weren't organic, artisinally designed APIs. It should also be trivial to model the APIs of other systems that I don't own. I should be able to use the same toolset to model the Github API, and be able to use the same kind of client that I would use to interact with systems that I *do* own.

Tools like Tapir and Servant are also an inspiration for my work here, with the name 'Cerato' being a shortening of the suborder that the tapir belongs to; ceratomorpha.
What I liked about all the tools mentioned above was that you defined your API somewhere, and got the a typesafe way of getting a client for that API, and a good experience when defining the server for these APIs.

## High level explanation

Cerato works on a fairly basic principal, that the API can be defined as an object that is later interpreted to create different results, such as a fetch-based client, or a Hono server.
To provide type safety all the information that defines the API must be present in the type system, and much of it must also exist at the value level so that runtime checks can be done, such as validating request and response values or determining what HTTP verb a specific handler should be handling.

Because there are no runtime types in Typescript, I use Zod to help verify any information coming "in" to achieve some measure of actual safety.

## Challenges

Because I'm relying on the definition of the API as a (potentially large) Typescript value and relying on a lot of type manipulation to infer the types of things like Hono handlers, the type errors can sometimes be horrific.

## Gaps with the work done so far

1. No way of tracking authentication, or other aspects of an API that I hadn't yet encountered in the original host project
2. No support for ~~non-json request and~~ response bodies
3. Modeling responses as a tuple of `[ResponseCode, ResponseBody]` "works" but I don't love it and I do some really horrible stuff when it comes to dealing with redirects
4. Go-to-reference sometimes takes you to library code rather than the API definition
5. Splitting out the different interpretation targets to supporting libraries to keep core library size down
6. No transformation of formatted data yet, [Zod codecs](https://zod.dev/codecs) are probably the answer here
7. The type ascription when you're splitting up routes with path params are awful at the moment, some type util would make this nicer
