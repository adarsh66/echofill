import os
import base64
import json
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from openai import AzureOpenAI
from flask_cors import CORS

from docxtpl import DocxTemplate
from azure.communication.email import EmailClient
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Load environment variables from the .env file
# load_dotenv()
# Load environment variables from the .env.local file if it exists
load_dotenv(dotenv_path='.env.local')

app = Flask(__name__)
CORS(app)
# Load environment variables from the .env file
gpt4o_model_name = os.getenv("gpt-4o_deployment_name")
gpt4o_api_version = os.getenv("gpt-4o_api_version")
gpt4o_endpoint = os.getenv("gpt-4o_azure_endpoint")
gpt4o_key = os.getenv("gpt-4o_api_key")

email_conn_str = os.getenv("email_conn_str")
sender_email = os.getenv("email_sender")
email_client = EmailClient.from_connection_string(email_conn_str)

SystemPrompt = "You are a customer service agent for Contoso, assisting consignees in filling out the necessary forms to collect their delivery.\
When user ask for help, you should provide a detailed note on the forms that need to be brought it for collection. \
Detailed notes are essential - Provide the details in two separate messages ie if user asks is there any other info to fill in ? provide additional details .\
Things like Identification has to be brought. Documents like Shipper LOI, Consignment Collection Form, and Identification are required - add any other data that usually being handled with consignment delivery for SME business users.\
If user says that he/she needs to call you - You **must** respond saying - Yes please call be by triggering the Call button at bottom of the screen"

SystemPromptHistory = "You are given a customer/bot conversation history where customer has provided necessary information . Your job is to extract the info in below JSON format \
if no conversation history is provided , send the json placeholder with email id filled in.\
if email is not present - fill in always with sathik.basha@microsoft.com \
`{\"email\":\"\",\"Consignee_name\": \"\",\"item_1\":\"Electronic Goods\", \"item_2\":\"General Item\", \"item_1_qty\":\"1\", \"item_2_qty\":\"1\",\"special_instructions\":\"\", \"verification_document\":\"\",\"collection_date\":\"\",\"tracking_no\":\"\",}`\
Dont repeat or provide any additional information. Just extract the information what is necessary - if not found leave it empty"


aoai_client = AzureOpenAI(
    api_key=gpt4o_key,  
    api_version=gpt4o_api_version,
    azure_endpoint=gpt4o_endpoint
)


# Function to fill the template
def fill_template(data):
    # Load the template
    template = DocxTemplate("Shipper_LOI.docx")
    # Render the template with the provided data
    print(data)
    # print(type(data))
    template.render(data)
    # Save the filled template as a new document
    output_filename = "Completed_Shipper_LOI-To-Sign.docx"
    template.save(output_filename)
    return output_filename

def send_email(doc_filename, recipient_email):
    try:
        message = MIMEMultipart("mixed")
        message["Subject"] = "Action Required: Document for Consignment Collection"
        message["From"] = sender_email
        message["To"] = recipient_email
        print(recipient_email)
            # Create the alternative part for plain text and HTML
        alternative_part = MIMEMultipart("alternative")
        plain_text = "Mail from Contoso Logistics Ltd"
        html_content = """
                    <html>
                    <body>
                        <p>Please find the attached document, which needs to be signed in order to complete the consignment collection process. We kindly request that you:</p>
                        <ul>
                        <li>Review the attached document.</li>
                        <li>Sign where indicated.</li>
                        <li>Bring the signed document to our warehouse at the address below with supporting documents</li>
                        </ul>
                        <p><strong>Warehouse Address:</strong><br>
                        Contoso Cargo Logistics Pte Ltd<br>
                        Changi Village<br>
                        Singapore, 123456
                        </p>
                        <p>For any questions, feel free to reach out.</p>
                    </body>
                    </html>"""
        # Attach plain text and HTML to the alternative part
        alternative_part.attach(MIMEText(plain_text, "plain"))
        alternative_part.attach(MIMEText(html_content, "html"))

        # Attach the alternative part to the main message
        message.attach(alternative_part)
            # Read the DOCX file and attach it as a MIMEApplication
        with open(doc_filename, "rb") as attachment_file:
                encoded_content = base64.b64encode(attachment_file.read()).decode("utf-8")

        # Prepare the message payload for Azure Communication Services
        email_message = {
            "senderAddress": message["From"],
            "recipients": {
                "to": [{"address": recipient_email}]
            },
            "content": {"subject": message["Subject"],"plainText": plain_text,"html": html_content},
            "attachments": [
                {
                    "name": doc_filename,
                    "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "contentInBase64": encoded_content  
                }
            ]
        }
        # Send the email
        poller = email_client.begin_send(email_message)
        result = poller.result()
        return result
    except Exception as ex:
        print('Exception: Message not sent')
        return "Message not sent"


def construct_chat_history(msg_history):
    chat_history = []
    for msg in msg_history:
        chat_history.append({"role": msg["role"], "content": msg["content"]})
    return chat_history

def get_chat_response(msg_history):
    messages = [{"role": "system", "content": SystemPrompt}]
    messages.extend(construct_chat_history(msg_history))
    response = aoai_client.chat.completions.create(model=gpt4o_model_name, messages=messages)
    return response


def process_msg_history(conv_history):
    # print(type(conv_history))
    messages = [{"role": "system", "content": SystemPromptHistory}]
    messages.extend([{"role": "user", "content": str(conv_history)}])
    response = aoai_client.chat.completions.create(model=gpt4o_model_name, messages=messages)
    aoai_response = response.choices[0].message.content
    print(aoai_response)
    cleaned_response = aoai_response.replace('json', '', 1).strip()
    # print(cleaned_response)
    data = ""
    try:
        cleaned_response = cleaned_response.strip('```').strip()
        print("Cleaned response with repr():", repr(cleaned_response))
        data = json.loads(cleaned_response)
        print("Parsed JSON:", data)
        return data
    except json.JSONDecodeError as e:
        print("JSON decoding failed:", e)
    # print(aoai_response.trim('json'))
        return data

# {"messages":[
#      {"role": "user", "content": "Hello, how are you?"},
#    {"role": "assistant", "content": "I'm good, thank you! How can I assist you today?"},
#    {"role": "user", "content": "I need some help with maths"}
# ]}
@app.route('/get_chat_response', methods=['POST'])
def chat_response():
    print(request.json)
    msg_history = request.json.get('messages', [])
    response = get_chat_response(msg_history)
    return jsonify({"text":response.choices[0].message.content})



@app.route('/form_send_email', methods=['POST'])
def generate_form_send_email():
    message_history = request.json.get('messageHistory', [])
    # print(message_history)
    document_info = process_msg_history(message_history)
    print(document_info)
    output_filename = fill_template(document_info)
    response = send_email(output_filename, document_info['email'])
    return jsonify({"text":response})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
