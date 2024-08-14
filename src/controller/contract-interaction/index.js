const vscode = acquireVsCodeApi();
const oldState = vscode.getState();

(function () {
  $(window).ready(() => {
    vscode.postMessage({
      type: "init",
    });
  });

  $(".result__info-title").click(function () {
    $(this).next(".result__info-data").toggle("hidden");
    $(this).find(".fa-chevron-down").toggleClass("rotate");
  });

  window.addEventListener("message", ({ data: { type, payload } }) => {
    switch (type) {
      case "init": {
        const { address, balance, abis } = payload.contract;
        const abisWithoutConstructor = abis.filter(
          (abi) => abi.type !== "constructor"
        );

        const functionsElement = $(".functions");
        functionsElement.empty();

        abisWithoutConstructor.forEach((abi) => {
          const functionElement = $(createFunctionElement(abi));

          functionElement.find(".function__interaction input").change(() => {
            functionElement
              .find(".function__arguments input")
              .each((index, input) => {
                input.value = "";
              });
          });

          functionElement.find(".function__arguments input").change(() => {
            functionElement.find(".function__interaction input").val("");
          });

          functionElement.find("button").click(() => {
            const ineractionInput = functionElement
              .find(".function__interaction input")
              .val();
            const argumentsInput = functionElement
              .find(".function__arguments input")
              .map((index, input) => input.value)
              .toArray();

            const resultArguments = ineractionInput
              ? ineractionInput.split(",").map((input) => input.trim())
              : argumentsInput;

            const type =
              abi.stateMutability === "view" || abi.stateMutability === "pure"
                ? "call"
                : "send";
            vscode.postMessage({
              type,
              payload: {
                functionName: abi.name,
                args: resultArguments,
              },
            });
          });
          functionsElement.append(functionElement);
        });
        $(".contract__address").text(`Address: ${address}`);
        $(".contract__balance").text(`Balance: ${balance}`);

        const functionElements = $(".function");
        functionElements.each((index, element) => {
          element = $(element);
          element.find(".function__show-arguments").click(() => {
            element.find(".function__arguments").toggleClass("hidden");
            element
              .find(".function__show-arguments .fa-chevron-down")
              .toggleClass("rotate");
            const argumentsElement = element.find(".function__arguments");
            if (
              argumentsElement.length > 0 &&
              !element.find(".function__arguments").hasClass("hidden")
            ) {
              element.find(".function__interaction input").addClass("hidden");
              element.find(".function__interaction button").addClass("stretch");
            } else {
              element
                .find(".function__interaction input")
                .removeClass("hidden");
              element
                .find(".function__interaction button")
                .removeClass("stretch");
            }
          });
        });

        break;
      }
      case "changeContractBalance": {
        const { balance } = payload;

        $(".contract__balance").text(`Balance: ${balance}`);
        break;
      }

      case "transactionResult": {
        const receiptElement = $(createReceiptElement(payload));
        receiptElement.find(".receipt__info-title").click(() => {
          receiptElement.find(".receipt__info-data").toggleClass("hidden");
          receiptElement
            .find(".receipt__info-title .fa-chevron-down")
            .toggleClass("rotate");
        });
        $(".receipts").append(receiptElement);

        break;
      }

      case "changeStorage": {
        const { storage } = payload;
        const parsedStorage = JSON.parse(storage);
        const storageElement = $(".contract__storage tbody");
        storageElement.empty();

        Object.keys(parsedStorage).forEach((key) => {
          const value = parsedStorage[key];
          storageElement.append(`
            <tr>
              <td>${key}</td>
              <td>${"0x".concat(value.slice(2))}</td>
            </tr>
          `);
        });
      }
    }
  });
})();

function createFunctionElement(abi) {
  const inputs = abi.inputs
    .map((input) => `${input.type} ${input.name}`)
    .join(", ");
  return `
    <div class="function">
      <div class="function__interaction">
        <button class=${abi.stateMutability}>${abi.name}</button>
        ${abi.inputs.length > 0 ? `<input  placeholder="${inputs}"/>` : ""}
          ${
            abi.inputs.length > 1
              ? `
          <div class="function__show-arguments">
            <i class="fa fa-chevron-down"></i>
          </div>`
              : ""
          }
      </div>
      ${
        abi.inputs.length > 0
          ? `<div class="function__arguments hidden">
        ${abi.inputs
          .map(
            (input) => `
                <div class="function__argument">
                  <div>${input.type} ${input.name}</div>
                  <input />
                </div>
              `
          )
          .join("")}
        </div>`
          : ""
      }
    </div>
  `;
}

function createReceiptElement(receipt) {
  const {
    txHash,
    from,
    to,
    amountSpent,
    totalSpent,
    executedGasUsed,
    input,
    output,
    error,
  } = receipt;

  if (error) {
    return `
    <div class="receipt__info">
        <div class="receipt__info-title">
        <i class="fas fa-times-circle" style="color: #dd0e0e;"></i>
          <div class="receipt__info-tx-hash">${txHash}</div>
          <i class="fa fa-chevron-down"></i>
        </div>
        <div class="receipt__info-data hidden">
          <div class="receipt__error">${error
            .split(",")
            .join("<br /><br />")}</div>
        </div>
      </div>
    `;
  }
  return `
      <div class="receipt__info">
        <div class="receipt__info-title">
          <i class="fas fa-check-circle" style="color: #76fc64"></i>
          <div class="receipt__info-tx-hash">${txHash}</div>
          <i class="fa fa-chevron-down"></i>
        </div>
        <div class="receipt__info-data hidden">
          <div class="receipt__info-from">
            <div>from</div>
            <div>:</div>
            <div>${from}</div>
          </div>
          <div class="receipt__info-to">
            <div>to</div>
            <div>:</div>
            <div>${to}</div>
          </div>
          <div class="receipt__info-gas-amount-spent">
            <div>gas amount spent(totalgas x gas price)</div>
            <div>:</div>
            <div>${amountSpent}</div>
          </div>
          <div class="receipt__info-gas-total-spent">
            <div>gas total spent</div>
            <div>:</div>
            <div>${totalSpent}</div>
          </div>
          <div class="receipt__info-gas-executedGasUsed">
            <div>executed gas used</div>
            <div>:</div>
            <div>${executedGasUsed}</div>
          </div>
          <div class="receipt__info-input">
            <div>input</div>
            <div>:</div>
            <div>[${input.join(",")}]</div>
          </div>
          <div class="receipt__info-output">
            <div>output</div>
            <div>:</div>
            <div>[${output.join(",")}]</div>
          </div>
        </div>
      </div>
  `;
}
