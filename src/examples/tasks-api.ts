import z from "zod";
import { createClientsFromApi } from "../client/fetch";
import { Endpoint } from "../Endpoint";
import { createHonoServer, type HonoHandlersFor } from "../servers/hono";

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  completedOn: z.date().nullable(),
});

type Task = z.infer<typeof taskSchema>;

const createTaskRequestSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const notFoundSchema = z.object({
  result: "failed",
  message: z.string(),
});

const tasksApi = {
  tasks: Endpoint.multi({
    GET: Endpoint.get()
      .query(
        z.object({
          completed: z.enum(["true", "false"]).optional(),
          tags: z.array(z.string()).optional(),
          limit: z.coerce.number().optional(),
        }),
      )
      .output(200, z.array(taskSchema)),
    POST: Endpoint.post()
      .input(createTaskRequestSchema)
      .output(200, taskSchema),
    children: {
      ":taskId": Endpoint.multi({
        GET: Endpoint.get().output(200, taskSchema).output(404, notFoundSchema),
        children: {
          complete: Endpoint.post()
            .output(200, taskSchema)
            .output(404, notFoundSchema),
        },
      }),
    },
  }),
};

type TasksApi = typeof tasksApi;

const tasksClient = createClientsFromApi(tasksApi);

const tasksClientExample = async () => {
  const createTaskResponse = await tasksClient.tasks.POST({
    body: {
      title: "Buy groceries",
      description: "Buy groceries for the week",
    },
  });

  const newTask = createTaskResponse.responseBody;

  const getTasksResponse = await tasksClient.tasks.GET({
    query: {
      completed: "false",
      tags: ["home", "urgent"],
      limit: 25,
    },
  });
  const allTasks = getTasksResponse.responseBody;

  console.log(`Retrieved all tasks, found ${allTasks.length} tasks`);

  const getTaskResponse = await tasksClient.tasks[":taskId"].GET({
    pathParams: { taskId: newTask.id },
  });

  if (getTaskResponse.status === 404) {
    console.error("Task not found");
    return undefined;
  }

  const task = getTaskResponse.responseBody;
  console.log("Task found", task);
};

let tasks: Task[] = [
  {
    id: "1",
    title: "Buy groceries",
    description: "Buy groceries for the week",
    completedOn: null,
  },
];

const taskHandlers: HonoHandlersFor<[], TasksApi, {}> = {
  tasks: {
    GET: async (ctx) => {
      console.log("Task query params", ctx.query);
      return [200, tasks];
    },
    POST: async (ctx) => {
      return [
        200,
        {
          id: "1",
          title: "Buy groceries",
          description: "Buy groceries for the week",
          completedOn: null,
        },
      ];
    },
    ":taskId": {
      GET: async (ctx) => {
        return [
          200,
          {
            id: "1",
            title: "Buy groceries",
            description: "Buy groceries for the week",
            completedOn: null,
          },
        ];
      },
      complete: async (ctx) => {
        const taskToUpdate = tasks.find(
          (task) => task.id === ctx.hono.req.param().taskId,
        );
        if (!taskToUpdate) {
          return [
            404,
            {
              result: "failed",
              message: "Task not found",
            },
          ];
        }
        const updatedTask = { ...taskToUpdate, completedOn: new Date() };

        const updatedTasks = tasks.map((task) =>
          task.id === ctx.hono.req.param().taskId ? updatedTask : task,
        );

        tasks = updatedTasks;

        return [200, updatedTask];
      },
    },
  },
};

const honoApp = createHonoServer(
  tasksApi,
  {
    ...taskHandlers,
  },
  {},
);
