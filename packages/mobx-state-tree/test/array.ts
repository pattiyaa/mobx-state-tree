import {
    unprotect,
    onSnapshot,
    onPatch,
    clone,
    isAlive,
    applyPatch,
    getPath,
    applySnapshot,
    getSnapshot,
    types
} from "../src"
import { observable } from "mobx"
const createTestFactories = () => {
    const ItemFactory = types.optional(
        types.model({
            to: "world"
        }),
        {}
    )
    const Factory = types.array(ItemFactory)
    return { Factory, ItemFactory }
}
// === FACTORY TESTS ===
test("it should create a factory", () => {
    const { Factory } = createTestFactories()
    expect(getSnapshot(Factory.create())).toEqual([])
})
test("it should succeed if not optional and no default provided", () => {
    const Factory = types.array(types.string)
    expect(Factory.create().toJSON()).toEqual([])
})
test("it should restore the state from the snapshot", () => {
    const { Factory } = createTestFactories()
    const instance = Factory.create([{ to: "universe" }])
    expect(getSnapshot(instance)).toEqual([{ to: "universe" }])
    expect("" + instance).toBe("AnonymousModel[]@<root>(1 items)")
})
// === SNAPSHOT TESTS ===
test("it should emit snapshots", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    unprotect(doc)
    let snapshots = []
    onSnapshot(doc, snapshot => snapshots.push(snapshot))
    doc.push(ItemFactory.create())
    expect(snapshots).toEqual([[{ to: "world" }]])
})
test("it should apply snapshots", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    applySnapshot(doc, [{ to: "universe" }])
    expect(getSnapshot(doc)).toEqual([{ to: "universe" }])
})
test("it should return a snapshot", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    unprotect(doc)
    doc.push(ItemFactory.create())
    expect(getSnapshot(doc)).toEqual([{ to: "world" }])
})
// === PATCHES TESTS ===
test("it should emit add patches", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    unprotect(doc)
    let patches = []
    onPatch(doc, patch => patches.push(patch))
    doc.push(ItemFactory.create({ to: "universe" }))
    expect(patches).toEqual([{ op: "add", path: "/0", value: { to: "universe" } }])
})
test("it should apply an add patch", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    applyPatch(doc, { op: "add", path: "/0", value: { to: "universe" } })
    expect(getSnapshot(doc)).toEqual([{ to: "universe" }])
})
test("it should emit update patches", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    unprotect(doc)
    doc.push(ItemFactory.create())
    let patches = []
    onPatch(doc, patch => patches.push(patch))
    doc[0] = ItemFactory.create({ to: "universe" })
    expect(patches).toEqual([{ op: "replace", path: "/0", value: { to: "universe" } }])
})
test("it should apply an update patch", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    applyPatch(doc, { op: "replace", path: "/0", value: { to: "universe" } })
    expect(getSnapshot(doc)).toEqual([{ to: "universe" }])
})
test("it should emit remove patches", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    unprotect(doc)
    doc.push(ItemFactory.create())
    let patches = []
    onPatch(doc, patch => patches.push(patch))
    doc.splice(0)
    expect(patches).toEqual([{ op: "remove", path: "/0" }])
})
test("it should apply a remove patch", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    unprotect(doc)
    doc.push(ItemFactory.create())
    doc.push(ItemFactory.create({ to: "universe" }))
    applyPatch(doc, { op: "remove", path: "/0" })
    expect(getSnapshot(doc)).toEqual([{ to: "universe" }])
})
test("it should apply patches", () => {
    const { Factory, ItemFactory } = createTestFactories()
    const doc = Factory.create()
    applyPatch(doc, [
        { op: "add", path: "/0", value: { to: "mars" } },
        { op: "replace", path: "/0", value: { to: "universe" } }
    ])
    expect(getSnapshot(doc)).toEqual([{ to: "universe" }])
})
// === TYPE CHECKS ===
test("it should check the type correctly", () => {
    const { Factory } = createTestFactories()
    const doc = Factory.create()
    expect(Factory.is(doc)).toEqual(true)
    expect(Factory.is([])).toEqual(true)
    expect(Factory.is({})).toEqual(false)
    expect(Factory.is([{ to: "mars" }])).toEqual(true)
    expect(Factory.is([{ wrongKey: true }])).toEqual(true)
    expect(Factory.is([{ to: true }])).toEqual(false)
})
test("paths shoud remain correct when splicing", () => {
    const store = types
        .model({
            todos: types.array(
                types.model("Task", {
                    done: false
                })
            )
        })
        .create({
            todos: [{}]
        })
    unprotect(store)
    expect(store.todos.map(getPath)).toEqual(["/todos/0"])
    store.todos.push({})
    expect(store.todos.map(getPath)).toEqual(["/todos/0", "/todos/1"])
    store.todos.unshift({})
    expect(store.todos.map(getPath)).toEqual(["/todos/0", "/todos/1", "/todos/2"])
    store.todos.splice(0, 2)
    expect(store.todos.map(getPath)).toEqual(["/todos/0"])
    store.todos.splice(0, 1, {}, {}, {})
    expect(store.todos.map(getPath)).toEqual(["/todos/0", "/todos/1", "/todos/2"])
    store.todos.remove(store.todos[1])
    expect(store.todos.map(getPath)).toEqual(["/todos/0", "/todos/1"])
})
test("items should be reconciled correctly when splicing - 1", () => {
    const Task = types.model("Task", {
        x: types.string
    })
    const a = Task.create({ x: "a" }),
        b = Task.create({ x: "b" }),
        c = Task.create({ x: "c" }),
        d = Task.create({ x: "d" })
    const store = types
        .model({
            todos: types.optional(types.array(Task), [])
        })
        .create({
            todos: [a]
        })
    unprotect(store)
    expect(store.todos.slice()).toEqual([a])
    expect(isAlive(a)).toBe(true)
    store.todos.push(b)
    expect(store.todos.slice()).toEqual([a, b])
    store.todos.unshift(c)
    expect(store.todos.slice()).toEqual([c, a, b])
    store.todos.splice(0, 2)
    expect(store.todos.slice()).toEqual([b])
    expect(isAlive(a)).toBe(false)
    expect(isAlive(b)).toBe(true)
    expect(isAlive(c)).toBe(false)
    expect(() => store.todos.splice(0, 1, a, c, d)).toThrowError(
        "[mobx-state-tree] Task@<root>[dead] cannot be used anymore as it has died; it has been removed from a state tree. If you want to remove an element from a tree and let it live on, use 'detach' or 'clone' the value"
    )
    store.todos.splice(0, 1, clone(a), clone(c), clone(d))
    expect(store.todos.map(_ => _.x)).toEqual(["a", "c", "d"])
})
test("items should be reconciled correctly when splicing - 2", () => {
    const Task = types.model("Task", {
        x: types.string
    })
    const a = Task.create({ x: "a" }),
        b = Task.create({ x: "b" }),
        c = Task.create({ x: "c" }),
        d = Task.create({ x: "d" })
    const store = types
        .model({
            todos: types.array(Task)
        })
        .create({
            todos: [a, b, c, d]
        })
    unprotect(store)
    store.todos.splice(2, 1, { x: "e" }, { x: "f" })
    // becomes, a, b, e, f, d
    expect(store.todos.length).toBe(5)
    expect(store.todos[0] === a).toBe(true)
    expect(store.todos[1] === b).toBe(true)
    expect(store.todos[2] !== c).toBe(true)
    expect(store.todos[2].x).toBe("e")
    expect(store.todos[3] !== d).toBe(true)
    expect(store.todos[3].x).toBe("f")
    expect(store.todos[4] === d).toBe(true) // preserved and moved
    expect(store.todos[4].x).toBe("d")
    expect(store.todos.map(getPath)).toEqual([
        "/todos/0",
        "/todos/1",
        "/todos/2",
        "/todos/3",
        "/todos/4"
    ])
    store.todos.splice(1, 3, { x: "g" })
    // becomes a, g, d
    expect(store.todos.length).toBe(3)
    expect(store.todos[0] === a).toBe(true)
    expect(store.todos[1].x).toBe("g")
    expect(store.todos[2].x).toBe("d")
    expect(store.todos[1] !== b).toBe(true)
    expect(store.todos[2] === d).toBe(true) // still original d
    expect(store.todos.map(getPath)).toEqual(["/todos/0", "/todos/1", "/todos/2"])
})
test("it should reconciliate keyed instances correctly", () => {
    const Store = types.model({
        todos: types.optional(
            types.array(
                types.model("Task", {
                    id: types.identifier(),
                    task: "",
                    done: false
                })
            ),
            []
        )
    })
    const store = Store.create({
        todos: [
            { id: "1", task: "coffee", done: false },
            { id: "2", task: "tea", done: false },
            { id: "3", task: "biscuit", done: false }
        ]
    })
    expect(store.todos.map(todo => todo.task)).toEqual(["coffee", "tea", "biscuit"])
    expect(store.todos.map(todo => todo.done)).toEqual([false, false, false])
    expect(store.todos.map(todo => todo.id)).toEqual(["1", "2", "3"])
    const coffee = store.todos[0]
    const tea = store.todos[1]
    const biscuit = store.todos[2]
    applySnapshot(store, {
        todos: [
            { id: "2", task: "Tee", done: true },
            { id: "1", task: "coffee", done: true },
            { id: "4", task: "biscuit", done: false },
            { id: "5", task: "stuffz", done: false }
        ]
    })
    expect(store.todos.map(todo => todo.task)).toEqual(["Tee", "coffee", "biscuit", "stuffz"])
    expect(store.todos.map(todo => todo.done)).toEqual([true, true, false, false])
    expect(store.todos.map(todo => todo.id)).toEqual(["2", "1", "4", "5"])
    expect(store.todos[0] === tea).toBe(true)
    expect(store.todos[1] === coffee).toBe(true)
    expect(store.todos[2] === biscuit).toBe(false)
})
test("it correctly reconciliate when swapping", () => {
    const Task = types.model("Task", {})
    const Store = types.model({
        todos: types.optional(types.array(Task), [])
    })
    const s = Store.create()
    unprotect(s)
    const a = Task.create()
    const b = Task.create()
    s.todos.push(a, b)
    s.todos.replace([b, a])
    expect(s.todos[0] === b).toBe(true)
    expect(s.todos[1] === a).toBe(true)
    expect(s.todos.map(getPath)).toEqual(["/todos/0", "/todos/1"])
})
test("it correctly reconciliate when swapping using snapshots", () => {
    const Task = types.model("Task", {})
    const Store = types.model({
        todos: types.optional(types.array(Task), [])
    })
    const s = Store.create()
    unprotect(s)
    const a = Task.create()
    const b = Task.create()
    s.todos.push(a, b)
    s.todos.replace([getSnapshot(b), getSnapshot(a)])
    expect(s.todos[0] === b).toBe(true)
    expect(s.todos[1] === a).toBe(true)
    expect(s.todos.map(getPath)).toEqual(["/todos/0", "/todos/1"])
    s.todos.push({})
    expect(s.todos[0] === b).toBe(true)
    expect(s.todos[1] === a).toBe(true)
    expect(s.todos.map(getPath)).toEqual(["/todos/0", "/todos/1", "/todos/2"])
})
test("it should not be allowed to add the same item twice to the same store", () => {
    const Task = types.model("Task", {})
    const Store = types.model({
        todos: types.optional(types.array(Task), [])
    })
    const s = Store.create()
    unprotect(s)
    const a = Task.create()
    s.todos.push(a)
    expect(() => {
        s.todos.push(a)
    }).toThrowError(
        "[mobx-state-tree] Cannot add an object to a state tree if it is already part of the same or another state tree. Tried to assign an object to '/todos/1', but it lives already at '/todos/0'"
    )
    const b = Task.create()
    expect(() => {
        s.todos.push(b, b)
    }).toThrowError(
        "[mobx-state-tree] Cannot add an object to a state tree if it is already part of the same or another state tree. Tried to assign an object to '/todos/2', but it lives already at '/todos/1'"
    )
})
test("it should support observable arrays", () => {
    const TestArray = types.array(types.number)
    const testArray = TestArray.create(observable([1, 2]))
    expect(testArray[0] === 1).toBe(true)
    expect(testArray.length === 2).toBe(true)
    expect(Array.isArray(testArray.slice())).toBe(true)
})
