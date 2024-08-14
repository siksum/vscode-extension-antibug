const vscode = acquireVsCodeApi();
const oldState = vscode.getState();

$(document).ready(() => {
  vscode.postMessage({
    type: "init",
  });

  window.addEventListener("message", ({ data: { type, payload } }) => {
    switch (type) {
      case "init": {
        const { files } = payload;
        const isKoreanSelected = true;
        const isEnglishSelected = false;

        initializeUI();
        viewHiddenContent();
        ContractSummaryTab();

        $(".result__item").on("click", "button.codeline", (event) => {
          const clickedElement = $(event.currentTarget);
          const codeLine = clickedElement
            .parent()
            .find(".codeline")
            .text()
            .trim();
          const impact = clickedElement.parent().find(".impact").text().trim();

          vscode.postMessage({
            type: "codeLinechecked",
            payload: {
              files,
              codeLine,
              impact,
            },
          });
        });

        $(".extract").click(() => {
          vscode.postMessage({
            type: "ExtractAuditReport",
            payload: {
              isKoreanSelected,
              isEnglishSelected,
            },
          });
        });

        break;
      }
    }
  });
});

function initializeUI() {
  const underline = $(".underline");
  const koreanButton = $(".korean button");
  const englishButton = $(".english button");

  function select(event) {
    underline.css("left", `${event.target.offsetLeft}px`);
    underline.css("width", `${event.target.offsetWidth}px`);
  }

  koreanButton.click((event) => {
    select(event);
    $(".korean-content").show();
    $(".english-content").hide();
    SecuritySummaryTab(".piechart1");
    isKoreanSelected = true;
    isEnglishSelected = false;
  });

  englishButton.click((event) => {
    select(event);
    $(".english-content").show();
    $(".korean-content").hide();
    SecuritySummaryTab(".piechart2");
    isKoreanSelected = false;
    isEnglishSelected = true;
  });

  koreanButton.trigger("click");
}

function viewHiddenContent() {
  $(".result__item").each((index, item) => {
    const button = $(item).find(".result__td-button");
    const hiddenContent = $(item).find(".result__hidden");

    button.on("click", () => {
      if (index !== 0) {
        $(item).toggleClass("show");
        button.text(button.text() === "+" ? "-" : "+");
      }

      hiddenContent.css("display", $(item).hasClass("show") ? "block" : "none");
    });

    if (index === 0) {
      button.css("pointer-events", "none");
    }
  });
}

function ContractSummaryTab() {
  const contractButton = $(".box__content button.menu1");
  const callgraphButton = $(".box__content button.menu2");
  const contractContent = $(".box__content-contract");
  const callgraphContent = $(".box__content-callgraph");

  contractButton.click(() => {
    contractContent.css("display", "block");
    callgraphContent.css("display", "none");
    contractButton.css("background-color", "#4e52d0");
    contractButton.css("color", "#fff");
    callgraphButton.css("background-color", "#fff");
    callgraphButton.css("color", "#4e52d0");
  });

  callgraphButton.click(() => {
    contractContent.css("display", "none");
    callgraphContent.css("display", "block");
    contractButton.css("background-color", "#fff");
    contractButton.css("color", "#4e52d0");
    callgraphButton.css("background-color", "#4e52d0");
    callgraphButton.css("color", "#fff");
  });

  contractContent.css("display", "block");
  callgraphContent.css("display", "none");

  contractButton.css("background-color", "#4e52d0");
  contractButton.css("color", "#fff");
  callgraphButton.css("background-color", "#fff");
  callgraphButton.css("color", "#4e52d0");
}

function SecuritySummaryTab(selector) {
  const dom = document.querySelector(selector);
  const myChart_piechart = echarts.init(dom, null, {
    renderer: "canvas",
    useDirtyRect: false,
  });

  const option = {
    tooltip: {
      trigger: "item",
    },
    series: [
      {
        type: "pie",
        radius: ["50%", "80%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: {
          show: false,
          position: "center",
        },
        emphasis: {
          scale: 1,
          label: {
            show: true,
            textStyle: {
              fontSize: 20,
            },
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          { value: 2, name: "High", itemStyle: { color: "#EF6666" } },
          { value: 1, name: "Medium", itemStyle: { color: "#FAC858" } },
          { value: 0, name: "Low", itemStyle: { color: "#92CC76" } },
          { value: 0, name: "Info", itemStyle: { color: "#5470C6" } },
        ],
      },
    ],
  };

  if (option && typeof option === "object") {
    myChart_piechart.setOption(option);
  }

  window.addEventListener("resize", myChart_piechart.resize);
}
