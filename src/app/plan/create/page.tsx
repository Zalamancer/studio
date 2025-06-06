(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([[101], {
  17759: (e, r, t) => {
      "use strict";
      t.d(r, {
          C5: () => g,
          MJ: () => x,
          Rr: () => y,
          eI: () => f,
          lR: () => h,
          lV: () => d,
          zB: () => u
      });
      var n = t(95155)
        , a = t(12115)
        , s = t(99708)
        , o = t(62177)
        , l = t(59434)
        , i = t(85057);
      let d = o.Op
        , c = a.createContext({})
        , u = e => {
          let {...r} = e;
          return (0,
          n.jsx)(c.Provider, {
              value: {
                  name: r.name
              },
              children: (0,
              n.jsx)(o.xI, {
                  ...r
              })
          })
      }
        , p = () => {
          let e = a.useContext(c)
            , r = a.useContext(m)
            , {getFieldState: t, formState: n} = (0,
          o.xW)()
            , s = t(e.name, n);
          if (!e)
              throw Error("useFormField should be used within <FormField>");
          let {id: l} = r;
          return {
              id: l,
              name: e.name,
              formItemId: "".concat(l, "-form-item"),
              formDescriptionId: "".concat(l, "-form-item-description"),
              formMessageId: "".concat(l, "-form-item-message"),
              ...s
          }
      }
        , m = a.createContext({})
        , f = a.forwardRef( (e, r) => {
          let {className: t, ...s} = e
            , o = a.useId();
          return (0,
          n.jsx)(m.Provider, {
              value: {
                  id: o
              },
              children: (0,
              n.jsx)("div", {
                  ref: r,
                  className: (0,
                  l.cn)("space-y-2", t),
                  ...s
              })
          })
      }
      );
      f.displayName = "FormItem";
      let h = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e
            , {error: s, formItemId: o} = p();
          return (0,
          n.jsx)(i.J, {
              ref: r,
              className: (0,
              l.cn)(s && "text-destructive", t),
              htmlFor: o,
              ...a
          })
      }
      );
      h.displayName = "FormLabel";
      let x = a.forwardRef( (e, r) => {
          let {...t} = e
            , {error: a, formItemId: o, formDescriptionId: l, formMessageId: i} = p();
          return (0,
          n.jsx)(s.DX, {
              ref: r,
              id: o,
              "aria-describedby": a ? "".concat(l, " ").concat(i) : "".concat(l),
              "aria-invalid": !!a,
              ...t
          })
      }
      );
      x.displayName = "FormControl";
      let y = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e
            , {formDescriptionId: s} = p();
          return (0,
          n.jsx)("p", {
              ref: r,
              id: s,
              className: (0,
              l.cn)("text-sm text-muted-foreground", t),
              ...a
          })
      }
      );
      y.displayName = "FormDescription";
      let g = a.forwardRef( (e, r) => {
          var t;
          let {className: a, children: s, ...o} = e
            , {error: i, formMessageId: d} = p()
            , c = i ? String(null != (t = null == i ? void 0 : i.message) ? t : "") : s;
          return c ? (0,
          n.jsx)("p", {
              ref: r,
              id: d,
              className: (0,
              l.cn)("text-sm font-medium text-destructive", a),
              ...o,
              children: c
          }) : null
      }
      );
      g.displayName = "FormMessage"
  }
  ,
  20012: (e, r, t) => {
      "use strict";
      t.d(r, {
          Md: () => l,
          Re: () => i,
          cd: () => d,
          qT: () => o
      });
      var n = t(67039)
        , a = t(35317);
      let s = (0,
      a.rJ)(n.db, "plans")
        , o = async e => {
          let r = n.j2.currentUser;
          if (!r)
              throw Error("User not authenticated. Cannot create plan.");
          if (r.uid !== e.ownerId)
              throw Error("Authenticated user does not match plan ownerId.");
          console.log("[planService] createPlan: Called by UID ".concat(r.uid, " with data:"), JSON.stringify(e, null, 2));
          let t = {
              name: e.name,
              ownerId: e.ownerId,
              sector: e.sector,
              subSector: e.subSector || null,
              industry: e.industry || null,
              naicsCode: e.naicsCode || null,
              createdAt: (0,
              a.O5)(),
              updatedAt: (0,
              a.O5)(),
              roadmap: (e.roadmap || []).map(e => ({
                  id: "string" == typeof e.id ? e.id : "init_step_id_".concat(Date.now()),
                  title: "string" == typeof e.title ? e.title : "",
                  x: "number" == typeof e.x ? e.x : 0,
                  y: "number" == typeof e.y ? e.y : 0,
                  description: void 0 === e.description || "" === e.description ? null : e.description,
                  subSteps: (e.subSteps || []).map(e => ({
                      id: "string" == typeof e.id ? e.id : "init_sub_id_".concat(Date.now()),
                      parentId: "string" == typeof e.parentId ? e.parentId : "",
                      title: "string" == typeof e.title ? e.title : ""
                  })),
                  ...void 0 !== e.sourceNodeId && {
                      sourceNodeId: e.sourceNodeId
                  },
                  ...void 0 !== e.sourceAnchor && {
                      sourceAnchor: e.sourceAnchor
                  },
                  ...void 0 !== e.sourceLineYOffset && {
                      sourceLineYOffset: e.sourceLineYOffset
                  }
              }))
          };
          console.log("%c[planService] createPlan: FINAL DATA OBJECT being sent to Firestore:", "color: #FF1493; font-weight: bold;", JSON.parse(JSON.stringify(t)));
          try {
              let e = await (0,
              a.gS)(s, t);
              return console.log("[planService] Plan created successfully with ID: ".concat(e.id, " by owner ").concat(r.uid)),
              e.id
          } catch (e) {
              if (console.error("[planService] Error creating plan:", e),
              "permission-denied" === e.code)
                  throw console.error("Firestore permission denied. Ensure security rules allow 'create' on 'plans/{planId}' collection under these conditions:"),
                  Error("Permission denied creating plan. Check Firestore security rules and console logs for details of data sent vs. rules expected.");
              throw Error(e.message || "Could not create plan.")
          }
      }
        , l = async e => {
          if (!e)
              return console.warn("[planService] getPlanById: No planId provided."),
              null;
          let r = n.j2.currentUser;
          console.log("[planService] getPlanById: Fetching plan with ID: '".concat(e, "'. Current auth UID: '").concat((null == r ? void 0 : r.uid) || "NULL", "'"));
          let t = (0,
          a.H9)(s, e);
          try {
              let r = await (0,
              a.x7)(t);
              if (r.exists()) {
                  var o, l;
                  let t = r.data()
                    , n = {
                      id: r.id,
                      name: t.name,
                      ownerId: t.ownerId,
                      sector: t.sector,
                      subSector: t.subSector || null,
                      industry: t.industry || null,
                      naicsCode: t.naicsCode || null,
                      createdAt: (null == (o = t.createdAt) ? void 0 : o.toMillis()) || Date.now(),
                      updatedAt: (null == (l = t.updatedAt) ? void 0 : l.toMillis()) || Date.now(),
                      roadmap: (t.roadmap || []).map(e => ({
                          ...e,
                          subSteps: e.subSteps || []
                      }))
                  };
                  return console.log("[planService] Plan ".concat(e, " fetched successfully.")),
                  n
              }
              return console.warn("[planService] No plan found with ID ".concat(e, ".")),
              null
          } catch (r) {
              if (console.error("[planService] Error fetching plan ".concat(e, ":"), r),
              "permission-denied" === r.code)
                  throw console.error("Ensure Firestore rules allow 'get' on `/plans/{planId}` if `request.auth.uid == resource.data.ownerId` (or other conditions for shared plans)."),
                  Error("Permission denied fetching plan. Check Firestore rules.");
              throw Error(r.message || "Could not fetch plan.")
          }
      }
        , i = async (e, r, t) => {
          let o = n.j2.currentUser;
          if (!o)
              throw Error("User not authenticated. Cannot update plan.");
          if (o.uid !== r)
              throw Error("Authenticated user does not match plan ownerId. Cannot update.");
          if (!e)
              throw Error("Plan ID is required to update roadmap.");
          console.log("[planService] updatePlanRoadmap: Updating roadmap for plan ID: ".concat(e, " by owner ").concat(r));
          let l = {
              roadmap: t.map(e => {
                  let r = (e.subSteps || []).map(e => ({
                      id: "string" == typeof e.id ? e.id : "invalid_sub_id_".concat(Date.now()),
                      parentId: "string" == typeof e.parentId ? e.parentId : "",
                      title: "string" == typeof e.title ? e.title : ""
                  }))
                    , t = {
                      id: "string" == typeof e.id ? e.id : "invalid_step_id_".concat(Date.now()),
                      title: "string" == typeof e.title ? e.title : "",
                      x: "number" == typeof e.x ? e.x : 0,
                      y: "number" == typeof e.y ? e.y : 0,
                      description: void 0 === e.description || "" === e.description ? null : e.description,
                      subSteps: r
                  };
                  return void 0 !== e.sourceNodeId && (t.sourceNodeId = e.sourceNodeId),
                  void 0 !== e.sourceAnchor && (t.sourceAnchor = e.sourceAnchor),
                  void 0 !== e.sourceLineYOffset && (t.sourceLineYOffset = e.sourceLineYOffset),
                  t
              }
              ),
              updatedAt: (0,
              a.O5)()
          }
            , i = (0,
          a.H9)(s, e);
          try {
              await (0,
              a.mZ)(i, l),
              console.log("[planService] Roadmap for plan ".concat(e, " updated successfully."))
          } catch (r) {
              if (console.error("[planService] Error updating roadmap for plan ".concat(e, ":"), r),
              "permission-denied" === r.code)
                  throw console.error("Firestore permission denied. Ensure security rules allow 'update' on 'plans/{planId}' for the owner, and that 'roadmap' and 'updatedAt' are allowed fields."),
                  Error("Permission denied updating plan roadmap. Check Firestore rules.");
              throw Error(r.message || "Could not update plan roadmap.")
          }
      }
        , d = async function() {
          let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 6;
          console.log("[planService] getRecentPlans: Fetching ".concat(e, " recent plans."));
          try {
              let r = (0,
              a.P)(s, (0,
              a.My)("createdAt", "desc"), (0,
              a.AB)(e))
                , t = (await (0,
              a.GG)(r)).docs.map(e => {
                  var r, t;
                  let n = e.data();
                  return {
                      id: e.id,
                      name: n.name,
                      ownerId: n.ownerId,
                      sector: n.sector,
                      subSector: n.subSector || null,
                      industry: n.industry || null,
                      naicsCode: n.naicsCode || null,
                      createdAt: (null == (r = n.createdAt) ? void 0 : r.toMillis()) || Date.now(),
                      updatedAt: (null == (t = n.updatedAt) ? void 0 : t.toMillis()) || Date.now(),
                      roadmap: (n.roadmap || []).map(e => ({
                          ...e,
                          subSteps: e.subSteps || []
                      }))
                  }
              }
              );
              return console.log("[planService] Fetched ".concat(t.length, " recent plans.")),
              t
          } catch (e) {
              if (console.error("[planService] Error fetching recent plans:", e),
              "permission-denied" === e.code)
                  throw console.error("Firestore permission denied fetching recent plans. Check rules for listing 'plans'."),
                  Error("Permission denied fetching recent plans. Check Firestore rules.");
              if ("failed-precondition" === e.code && e.message.includes("index"))
                  throw console.error("Firestore query for recent plans requires an index on 'createdAt' (desc). Please create it in the Firebase console for the 'plans' collection."),
                  Error("Firestore query requires an index for recent plans. Please create it.");
              throw Error("Failed to fetch recent plans: ".concat(e.message || "Unknown error"))
          }
      }
  }
  ,
  38987: (e, r, t) => {
      Promise.resolve().then(t.bind(t, 78597))
  }
  ,
  59409: (e, r, t) => {
      "use strict";
      t.d(r, {
          bq: () => p,
          eb: () => x,
          gC: () => h,
          l6: () => c,
          yv: () => u
      });
      var n = t(95155)
        , a = t(12115)
        , s = t(31992)
        , o = t(79556)
        , l = t(77381)
        , i = t(10518)
        , d = t(59434);
      let c = s.bL;
      s.YJ;
      let u = s.WT
        , p = a.forwardRef( (e, r) => {
          let {className: t, children: a, ...l} = e;
          return (0,
          n.jsxs)(s.l9, {
              ref: r,
              className: (0,
              d.cn)("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", t),
              ...l,
              children: [a, (0,
              n.jsx)(s.In, {
                  asChild: !0,
                  children: (0,
                  n.jsx)(o.A, {
                      className: "h-4 w-4 opacity-50"
                  })
              })]
          })
      }
      );
      p.displayName = s.l9.displayName;
      let m = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)(s.PP, {
              ref: r,
              className: (0,
              d.cn)("flex cursor-default items-center justify-center py-1", t),
              ...a,
              children: (0,
              n.jsx)(l.A, {
                  className: "h-4 w-4"
              })
          })
      }
      );
      m.displayName = s.PP.displayName;
      let f = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)(s.wn, {
              ref: r,
              className: (0,
              d.cn)("flex cursor-default items-center justify-center py-1", t),
              ...a,
              children: (0,
              n.jsx)(o.A, {
                  className: "h-4 w-4"
              })
          })
      }
      );
      f.displayName = s.wn.displayName;
      let h = a.forwardRef( (e, r) => {
          let {className: t, children: a, position: o="popper", ...l} = e;
          return (0,
          n.jsx)(s.ZL, {
              children: (0,
              n.jsxs)(s.UC, {
                  ref: r,
                  className: (0,
                  d.cn)("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", "popper" === o && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", t),
                  position: o,
                  ...l,
                  children: [(0,
                  n.jsx)(m, {}), (0,
                  n.jsx)(s.LM, {
                      className: (0,
                      d.cn)("p-1", "popper" === o && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
                      children: a
                  }), (0,
                  n.jsx)(f, {})]
              })
          })
      }
      );
      h.displayName = s.UC.displayName,
      a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)(s.JU, {
              ref: r,
              className: (0,
              d.cn)("py-1.5 pl-8 pr-2 text-sm font-semibold", t),
              ...a
          })
      }
      ).displayName = s.JU.displayName;
      let x = a.forwardRef( (e, r) => {
          let {className: t, children: a, ...o} = e;
          return (0,
          n.jsxs)(s.q7, {
              ref: r,
              className: (0,
              d.cn)("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", t),
              ...o,
              children: [(0,
              n.jsx)("span", {
                  className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                  children: (0,
                  n.jsx)(s.VF, {
                      children: (0,
                      n.jsx)(i.A, {
                          className: "h-4 w-4"
                      })
                  })
              }), (0,
              n.jsx)(s.p4, {
                  children: a
              })]
          })
      }
      );
      x.displayName = s.q7.displayName,
      a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)(s.wv, {
              ref: r,
              className: (0,
              d.cn)("-mx-1 my-1 h-px bg-muted", t),
              ...a
          })
      }
      ).displayName = s.wv.displayName
  }
  ,
  62523: (e, r, t) => {
      "use strict";
      t.d(r, {
          p: () => o
      });
      var n = t(95155)
        , a = t(12115)
        , s = t(59434);
      let o = a.forwardRef( (e, r) => {
          let {className: t, type: a, ...o} = e;
          return (0,
          n.jsx)("input", {
              type: a,
              className: (0,
              s.cn)("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", t),
              ref: r,
              ...o
          })
      }
      );
      o.displayName = "Input"
  }
  ,
  66695: (e, r, t) => {
      "use strict";
      t.d(r, {
          BT: () => d,
          Wu: () => c,
          ZB: () => i,
          Zp: () => o,
          aR: () => l,
          wL: () => u
      });
      var n = t(95155)
        , a = t(12115)
        , s = t(59434);
      let o = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)("div", {
              ref: r,
              className: (0,
              s.cn)("rounded-lg border bg-card text-card-foreground shadow-sm", t),
              ...a
          })
      }
      );
      o.displayName = "Card";
      let l = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)("div", {
              ref: r,
              className: (0,
              s.cn)("flex flex-col space-y-1.5 p-6", t),
              ...a
          })
      }
      );
      l.displayName = "CardHeader";
      let i = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)("h3", {
              ref: r,
              className: (0,
              s.cn)("text-2xl font-semibold leading-none tracking-tight", t),
              ...a
          })
      }
      );
      i.displayName = "CardTitle";
      let d = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)("p", {
              ref: r,
              className: (0,
              s.cn)("text-sm text-muted-foreground", t),
              ...a
          })
      }
      );
      d.displayName = "CardDescription";
      let c = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)("div", {
              ref: r,
              className: (0,
              s.cn)("p-6 pt-0", t),
              ...a
          })
      }
      );
      c.displayName = "CardContent";
      let u = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)("div", {
              ref: r,
              className: (0,
              s.cn)("flex items-center p-6 pt-0", t),
              ...a
          })
      }
      );
      u.displayName = "CardFooter"
  }
  ,
  78597: (e, r, t) => {
      "use strict";
      t.r(r),
      t.d(r, {
          default: () => v
      });
      var n = t(95155)
        , a = t(12115)
        , s = t(35695)
        , o = t(40283)
        , l = t(87481)
        , i = t(62177)
        , d = t(90221)
        , c = t(71153)
        , u = t(30285)
        , p = t(62523)
        , m = t(17759)
        , f = t(59409)
        , h = t(50172)
        , x = t(45554);
      let y = c.Ik({
          name: c.Yj().min(3, "Plan name must be at least 3 characters.").max(100, "Plan name cannot exceed 100 characters."),
          sector: c.Yj().min(1, "Please select a sector."),
          subSector: c.Yj().optional(),
          industry: c.Yj().optional()
      })
        , g = e => {
          let {onSubmit: r, detailedSectorsData: t, isSubmitting: s, currentUserId: o} = e
            , l = (0,
          i.mN)({
              resolver: (0,
              d.u)(y),
              defaultValues: {
                  name: "",
                  sector: "",
                  subSector: "",
                  industry: ""
              }
          })
            , [c,g] = (0,
          a.useState)([])
            , [b,j] = (0,
          a.useState)([])
            , w = l.watch("sector");
          (0,
          a.useEffect)( () => {
              if (w) {
                  let e = t.find(e => e.code === w);
                  g((null == e ? void 0 : e.subSectors) || []),
                  l.setValue("subSector", "", {
                      shouldValidate: !0
                  }),
                  l.setValue("industry", "", {
                      shouldValidate: !0
                  }),
                  j([])
              } else
                  g([]),
                  j([])
          }
          , [w, t, l]);
          let v = l.watch("subSector");
          (0,
          a.useEffect)( () => {
              if (v) {
                  let e = c.find(e => e.code === v);
                  j((null == e ? void 0 : e.industries) || []),
                  l.setValue("industry", "", {
                      shouldValidate: !0
                  })
              } else
                  j([])
          }
          , [v, c, l]);
          let N = async e => {
              await r(e)
          }
          ;
          return (0,
          n.jsx)(m.lV, {
              ...l,
              children: (0,
              n.jsxs)("form", {
                  onSubmit: l.handleSubmit(N),
                  className: "space-y-6",
                  children: [(0,
                  n.jsx)(m.zB, {
                      control: l.control,
                      name: "name",
                      render: e => {
                          let {field: r} = e;
                          return (0,
                          n.jsxs)(m.eI, {
                              children: [(0,
                              n.jsxs)(m.lR, {
                                  children: ["Plan Name ", (0,
                                  n.jsx)("span", {
                                      className: "text-destructive",
                                      children: "*"
                                  })]
                              }), (0,
                              n.jsx)(m.MJ, {
                                  children: (0,
                                  n.jsx)(p.p, {
                                      placeholder: "e.g., Q4 Marketing Strategy, New Product Launch Plan",
                                      ...r,
                                      disabled: s
                                  })
                              }), (0,
                              n.jsx)(m.Rr, {
                                  children: "Give your collaboration plan a clear and concise name."
                              }), (0,
                              n.jsx)(m.C5, {})]
                          })
                      }
                  }), (0,
                  n.jsx)(m.zB, {
                      control: l.control,
                      name: "sector",
                      render: e => {
                          let {field: r} = e;
                          return (0,
                          n.jsxs)(m.eI, {
                              children: [(0,
                              n.jsxs)(m.lR, {
                                  children: ["Sector ", (0,
                                  n.jsx)("span", {
                                      className: "text-destructive",
                                      children: "*"
                                  })]
                              }), (0,
                              n.jsxs)(f.l6, {
                                  onValueChange: r.onChange,
                                  value: r.value,
                                  disabled: s,
                                  children: [(0,
                                  n.jsx)(m.MJ, {
                                      children: (0,
                                      n.jsx)(f.bq, {
                                          children: (0,
                                          n.jsx)(f.yv, {
                                              placeholder: "Select a main sector"
                                          })
                                      })
                                  }), (0,
                                  n.jsx)(f.gC, {
                                      children: t.map(e => (0,
                                      n.jsxs)(f.eb, {
                                          value: e.code,
                                          children: [e.name, " (", e.code, ")"]
                                      }, e.code))
                                  })]
                              }), (0,
                              n.jsx)(m.Rr, {
                                  children: "Choose the primary sector this plan relates to."
                              }), (0,
                              n.jsx)(m.C5, {})]
                          })
                      }
                  }), (0,
                  n.jsx)(m.zB, {
                      control: l.control,
                      name: "subSector",
                      render: e => {
                          let {field: r} = e;
                          return (0,
                          n.jsxs)(m.eI, {
                              children: [(0,
                              n.jsx)(m.lR, {
                                  children: "Sub-Sector (Optional)"
                              }), (0,
                              n.jsxs)(f.l6, {
                                  onValueChange: r.onChange,
                                  value: r.value || "",
                                  disabled: s || 0 === c.length,
                                  children: [(0,
                                  n.jsx)(m.MJ, {
                                      children: (0,
                                      n.jsx)(f.bq, {
                                          children: (0,
                                          n.jsx)(f.yv, {
                                              placeholder: c.length > 0 ? "Select a sub-sector" : "Select sector first"
                                          })
                                      })
                                  }), (0,
                                  n.jsx)(f.gC, {
                                      children: c.map(e => (0,
                                      n.jsxs)(f.eb, {
                                          value: e.code,
                                          children: [e.name, " (", e.code, ")"]
                                      }, e.code))
                                  })]
                              }), (0,
                              n.jsx)(m.Rr, {
                                  children: "Further specify the sub-sector if applicable."
                              }), (0,
                              n.jsx)(m.C5, {})]
                          })
                      }
                  }), (0,
                  n.jsx)(m.zB, {
                      control: l.control,
                      name: "industry",
                      render: e => {
                          let {field: r} = e;
                          return (0,
                          n.jsxs)(m.eI, {
                              children: [(0,
                              n.jsx)(m.lR, {
                                  children: "Industry (Optional)"
                              }), (0,
                              n.jsxs)(f.l6, {
                                  onValueChange: r.onChange,
                                  value: r.value || "",
                                  disabled: s || 0 === b.length,
                                  children: [(0,
                                  n.jsx)(m.MJ, {
                                      children: (0,
                                      n.jsx)(f.bq, {
                                          children: (0,
                                          n.jsx)(f.yv, {
                                              placeholder: b.length > 0 ? "Select an industry" : "Select sub-sector first"
                                          })
                                      })
                                  }), (0,
                                  n.jsx)(f.gC, {
                                      children: b.map(e => (0,
                                      n.jsxs)(f.eb, {
                                          value: e.code,
                                          children: [e.name, " (", e.code, ")"]
                                      }, e.code))
                                  })]
                              }), (0,
                              n.jsx)(m.Rr, {
                                  children: "Choose the specific industry if applicable."
                              }), (0,
                              n.jsx)(m.C5, {})]
                          })
                      }
                  }), (0,
                  n.jsx)("div", {
                      className: "flex justify-end pt-4",
                      children: (0,
                      n.jsx)(u.$, {
                          type: "submit",
                          disabled: s,
                          children: s ? (0,
                          n.jsxs)(n.Fragment, {
                              children: [(0,
                              n.jsx)(h.A, {
                                  className: "mr-2 h-4 w-4 animate-spin"
                              }), " Creating Plan..."]
                          }) : (0,
                          n.jsxs)(n.Fragment, {
                              children: [(0,
                              n.jsx)(x.A, {
                                  className: "mr-2 h-4 w-4"
                              }), " Create Plan"]
                          })
                      })
                  })]
              })
          })
      }
      ;
      var b = t(20012)
        , j = t(43304)
        , w = t(66695);
      let v = () => {
          let {user: e, loading: r} = (0,
          o.A)()
            , t = (0,
          s.useRouter)()
            , {toast: i} = (0,
          l.dj)()
            , [d,c] = a.useState(!1)
            , p = async r => {
              if (!e)
                  return void i({
                      variant: "destructive",
                      title: "Authentication Required",
                      description: "You must be logged in to create a plan."
                  });
              c(!0);
              let n = j.mu.find(e => e.code === r.sector)
                , a = null == n ? void 0 : n.subSectors.find(e => e.code === r.subSector)
                , s = null == a ? void 0 : a.industries.find(e => e.code === r.industry)
                , o = {
                  name: r.name,
                  ownerId: e.uid,
                  sector: (null == n ? void 0 : n.name) || r.sector,
                  subSector: (null == a ? void 0 : a.name) || null,
                  industry: (null == s ? void 0 : s.name) || null,
                  naicsCode: r.industry || r.subSector || r.sector
              };
              try {
                  let e = await (0,
                  b.qT)(o);
                  i({
                      title: "Plan Created!",
                      description: '"'.concat(r.name, '" has been successfully created.')
                  }),
                  t.push("/plan/".concat(e))
              } catch (e) {
                  i({
                      variant: "destructive",
                      title: "Failed to Create Plan",
                      description: e.message || "An unexpected error occurred."
                  }),
                  c(!1)
              }
          }
          ;
          return r ? (0,
          n.jsx)("div", {
              className: "container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-8rem)]",
              children: (0,
              n.jsx)(h.A, {
                  className: "h-12 w-12 animate-spin text-primary"
              })
          }) : e ? (0,
          n.jsx)("div", {
              className: "container mx-auto p-4 md:p-8",
              children: (0,
              n.jsxs)(w.Zp, {
                  className: "max-w-2xl mx-auto shadow-lg",
                  children: [(0,
                  n.jsxs)(w.aR, {
                      children: [(0,
                      n.jsx)(w.ZB, {
                          className: "text-2xl font-bold",
                          children: "Create New Collaboration Plan"
                      }), (0,
                      n.jsx)(w.BT, {
                          children: "Define a new space for focused collaboration and planning."
                      })]
                  }), (0,
                  n.jsx)(w.Wu, {
                      children: (0,
                      n.jsx)(g, {
                          onSubmit: p,
                          detailedSectorsData: j.mu,
                          isSubmitting: d,
                          currentUserId: e.uid
                      })
                  })]
              })
          }) : (0,
          n.jsx)("div", {
              className: "container mx-auto p-4 md:p-8 text-center",
              children: (0,
              n.jsxs)(w.Zp, {
                  className: "max-w-md mx-auto",
                  children: [(0,
                  n.jsxs)(w.aR, {
                      children: [(0,
                      n.jsx)(w.ZB, {
                          children: "Access Denied"
                      }), (0,
                      n.jsx)(w.BT, {
                          children: "You need to be logged in to create a collaboration plan."
                      })]
                  }), (0,
                  n.jsx)(w.Wu, {
                      children: (0,
                      n.jsx)(u.$, {
                          onClick: () => t.push("/login"),
                          children: "Log In"
                      })
                  })]
              })
          })
      }
  }
  ,
  85057: (e, r, t) => {
      "use strict";
      t.d(r, {
          J: () => d
      });
      var n = t(95155)
        , a = t(12115)
        , s = t(40968)
        , o = t(74466)
        , l = t(59434);
      let i = (0,
      o.F)("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70")
        , d = a.forwardRef( (e, r) => {
          let {className: t, ...a} = e;
          return (0,
          n.jsx)(s.b, {
              ref: r,
              className: (0,
              l.cn)(i(), t),
              ...a
          })
      }
      );
      d.displayName = s.b.displayName
  }
}, e => {
  var r = r => e(e.s = r);
  e.O(0, [2992, 6073, 4277, 3340, 6874, 5236, 587, 5452, 5041, 972, 2115, 861, 6164, 1556, 7115, 5292, 9164, 1850, 3304, 8441, 1684, 7358], () => r(38987)),
  _N_E = e.O()
}
]);
