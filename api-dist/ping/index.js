const pingFunction = async function (context, req) {
    context.log("ping invoked", {
        method: req.method,
        url: req.url,
    });
    if (req.method === "OPTIONS") {
        context.res = {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        };
        return;
    }
    context.res = {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
        },
        body: "hello world",
    };
};
export default pingFunction;
