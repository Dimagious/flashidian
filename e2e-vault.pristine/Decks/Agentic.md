# Agentic

**Agentic Loop**
?
A control flow where Claude repeatedly receives input, decides on an action, observes the result, and continues until the task is complete.
**Exam:** the loop ends on `end_turn`, not on `tool_use`.

**stop_reason**
?
Why the model stopped generating: `end_turn` or `tool_use` in the exam.

**Subagent**
?
A separate Claude instance with its own context that the coordinator delegates a subtask to.
