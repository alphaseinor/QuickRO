
enyo.kind({
          name: "App",
          kind: "FittableRows",
          classes: "onyx enyo-fit",
          components: [
                       {kind: "onyx.Toolbar", components: [
                                                           {content: "QuickRO"},
                                                           ]},
                       {kind: "Panels", fit: true, classes: "panels-sample-sliding-panels", arrangerKind: "CollapsingArranger", wrap: false, components: [
                                                                                                                                                          {name: "left", components: [
                                                                                                                                                                                      {kind: "List", classes: "enyo-fit", touch: true, count: 5, onSetupItem: "setupItem", item: "item1", components: [
                                                                                                                                                                                                                                                                                                          {name: "item1", classes: "panels-sample-sliding-item"}
                                                                                                                                                                                                                                                                                                          ]}
                                                                                                                                                                                      ]},
                                                                                                                                                          {name: "middle", components: [
                                                                                                                                                                                        {kind: "List", classes: "enyo-fit", touch: true, count: 4, onSetupItem: "setupItem", item: "item2", components: [
                                                                                                                                                                                                                                                                                                            {name: "item2", classes: "panels-sample-sliding-item"}
                                                                                                                                                                                                                                                                                                            ]}
                                                                                                                                                                                        ]},
                                                                                                                                                          {name: "body", fit: true, components: [
                                                                                                                                                                                                 {kind: "Scroller", classes: "enyo-fit", touch: true, components: [
                                                                                                                                                                                                                                                                   {classes: "panels-sample-sliding-content", content: "QuickRO"}
                                                                                                                                                                                                                                                                   ]}
                                                                                                                                                                                                 ]}
                                                                                                                                                          ]}
                       ],
          setupItem: function(inSender, inEvent) {
          this.$[inSender.item].setContent("This is row number: " + inEvent.index);
          },
          checkboxChange: function(inSender) {
          this.log();
          this.$.panels.realtimeFit = inSender.getValue();
          }
          });